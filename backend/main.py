from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text  # Додано для оновлення БД
from pydantic import BaseModel
from typing import Optional, List
from fastapi.responses import FileResponse
import pdfkit
import jinja2

from database.db import engine, SessionLocal
from database.models import Base, Document, User, Department, Template, Signature, Contractor, AuditLog
import auth

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Zernari PDF API (Secured)")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://zernari-pdf.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- ДОПОМІЖНА ФУНКЦІЯ: АУДИТ ---
def log_audit(db: Session, user_id, action: str, details: str = None):
    new_log = AuditLog(
        user_id=user_id, 
        action=action, 
        details=details
    )
    db.add(new_log)
    db.commit()

# --- СИСТЕМА БЕЗПЕКИ ТА АВТОРИЗАЦІЇ ---
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не вдалося перевірити облікові дані",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except auth.jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Термін дії токена закінчився")
    except auth.jwt.InvalidTokenError:
        raise credentials_exception
    
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

@app.get("/setup-admin/")
def setup_admin(db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == "yegor@zernari.com").first()
    if existing_user:
        return {"message": "Адміністратор вже існує!"}
    
    it_dept = db.query(Department).filter(Department.name == "ІТ-відділ").first()
    if not it_dept:
        it_dept = Department(name="ІТ-відділ", description="Підрозділ інформационных технологій")
        db.add(it_dept)
        db.commit()
        db.refresh(it_dept)

    hashed_pw = auth.get_password_hash("admin123")
    new_user = User(
        full_name="Єгор Железняк",
        email="yegor@zernari.com",
        password_hash=hashed_pw,
        role="admin",
        position="Помічник фахівця з інженерії програмного забезпечення",
        department_id=it_dept.id
    )
    db.add(new_user)
    db.commit()
    return {"message": "Твій обліковий запис успішно створено!"}

# --- МАРШРУТ ДЛЯ ОНОВЛЕННЯ БД (БЕЗ SQL КЛІЄНТІВ) ---
@app.get("/upgrade-db/")
def upgrade_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE contractors ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;"))
        db.commit()
        return {"message": "Базу даних успішно оновлено! Додано колонку is_active для контрагентів."}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}

@app.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Невірна пошта або пароль")
    
    access_token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    
    log_audit(db, user.id, "Вхід в систему", f"Користувач {user.email} успішно авторизувався")
    return {"access_token": access_token, "token_type": "bearer"}

# --- МАРШРУТИ УПРАВЛІННЯ КОРИСТУВАЧАМИ (RBAC) ---
class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str
    role: str = "user"
    position: Optional[str] = None
    department_name: Optional[str] = None

@app.get("/users/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
        "position": current_user.position,
        "department": current_user.department.name if current_user.department else "Не вказано"
    }

@app.get("/users/")
def get_all_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Доступ заборонено")
    
    users = db.query(User).all()
    result = []
    for u in users:
        result.append({
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "position": u.position,
            "department": u.department.name if u.department else "Не вказано"
        })
    return result

@app.post("/users/")
def create_user(user_data: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Доступ заборонено. Тільки для адміністраторів.")
    
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Користувач з такою поштою вже існує")
    
    dept_id = None
    if user_data.department_name:
        dept = db.query(Department).filter(Department.name == user_data.department_name).first()
        if not dept:
            dept = Department(name=user_data.department_name)
            db.add(dept)
            db.commit()
            db.refresh(dept)
        dept_id = dept.id

    hashed_pw = auth.get_password_hash(user_data.password)
    new_user = User(
        full_name=user_data.full_name, 
        email=user_data.email, 
        password_hash=hashed_pw, 
        role=user_data.role, 
        position=user_data.position, 
        department_id=dept_id
    )
    db.add(new_user)
    db.commit()
    
    log_audit(db, current_user.id, "Реєстрація співробітника", f"Створено акаунт: {user_data.email}")
    return {"message": f"Користувача {user_data.full_name} успішно створено!"}

@app.delete("/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Доступ заборонено")
    if str(current_user.id) == user_id:
        raise HTTPException(status_code=400, detail="Не можна видалити самого себе!")
    
    user_to_delete = db.query(User).filter(User.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="Користувача не знайдено")
    
    try:
        email_deleted = user_to_delete.email
        db.delete(user_to_delete)
        db.commit()
        log_audit(db, current_user.id, "Видалення користувача", f"Видалено акаунт: {email_deleted}")
        return {"message": "Користувача успішно видалено!"}
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Неможливо видалити користувача, оскільки він має зв'язані документи або підписи в архіві."
        )

# --- ЖУРНАЛ АУДИТУ ---
@app.get("/audit-logs/")
def get_audit_logs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Доступ лише для адміністратора")
    
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100).all()
    result = []
    for l in logs:
        result.append({
            "id": str(l.id),
            "action": l.action,
            "details": l.details,
            "timestamp": l.timestamp.strftime("%d.%m.%Y %H:%M:%S"),
            "user_name": l.user.full_name if l.user else "Система"
        })
    return result

# --- КОНТРАГЕНТИ ---
class ContractorCreate(BaseModel):
    legal_name: str
    edrpou: str
    address: Optional[str] = None
    contacts: Optional[str] = None

@app.get("/contractors/")
def get_contractors(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    contractors = db.query(Contractor).order_by(Contractor.legal_name).all()
    result = []
    for c in contractors:
        result.append({
            "id": str(c.id),
            "legal_name": c.legal_name,
            "edrpou": c.edrpou,
            "address": c.address,
            "contacts": c.contacts,
            "is_active": c.is_active
        })
    return result

@app.post("/contractors/")
def create_contractor(c_data: ContractorCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_contractor = Contractor(
        legal_name=c_data.legal_name, 
        edrpou=c_data.edrpou, 
        address=c_data.address, 
        contacts=c_data.contacts
    )
    db.add(new_contractor)
    db.commit()
    log_audit(db, current_user.id, "Додавання контрагента", f"Додано: {c_data.legal_name}")
    return {"message": "Контрагента успішно збережено!"}

@app.patch("/contractors/{contractor_id}/toggle")
def toggle_contractor(contractor_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Contractor).filter(Contractor.id == contractor_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Контрагента не знайдено")
    
    c.is_active = not c.is_active
    db.commit()
    
    status_text = "відновлено" if c.is_active else "деактивовано"
    log_audit(db, current_user.id, "Зміна статусу контрагента", f"Контрагента {c.legal_name} {status_text}")
    
    return {"message": f"Контрагента успішно {status_text}!"}

# --- СИСТЕМА ШАБЛОНІВ ТА КАТАЛОГ ---
@app.get("/setup-templates/")
def setup_templates(db: Session = Depends(get_db)):
    db.query(Template).delete()
    db.commit()

    templates_data = [
        {
            "name": "ТТН (Логістика)",
            "category": "Логістика",
            "structure": {
                "doc_type": "ttn",
                "description": "Товарно-транспортна накладна",
                "fields": [
                    {"name": "title", "label": "Назва запису", "type": "text", "placeholder": "Напр: Борошно для Сільпо"},
                    {"name": "carrier", "label": "Перевізник", "type": "text", "placeholder": "Напр: ФОП Анатолієв З. І."},
                    {"name": "sender", "label": "Відправник", "type": "text", "default": "ТОВ «ЗЕРНАРІ»"},
                    {"name": "receiver", "label": "Одержувач", "type": "text", "placeholder": "ТОВ «АТБ-Маркет»"},
                    {"name": "load_point", "label": "Пункт навантаження", "type": "text"},
                    {"name": "unload_point", "label": "Пункт розвантаження", "type": "text"}
                ],
                "has_cargo_table": True
            }
        },
        {
            "name": "Звіт лабораторії (Якість)",
            "category": "Лабораторія",
            "structure": {
                "doc_type": "lab_report",
                "description": "Форма звіту аналізу зернових культур",
                "fields": [
                    {"name": "title", "label": "Назва звіту", "type": "text", "placeholder": "Аналіз №..."},
                    {"name": "crop_name", "label": "Культура", "type": "text", "placeholder": "Напр: Пшениця 1 кл."},
                    {"name": "moisture", "label": "Вологість (%)", "type": "number"},
                    {"name": "gluten", "label": "Клейковина (%)", "type": "number"},
                    {"name": "impurities", "label": "Домішки (%)", "type": "number"},
                    {"name": "lab_technician", "label": "Відповідальний лаборант", "type": "text", "placeholder": "ПІБ лаборанта"}
                ],
                "has_cargo_table": False
            }
        },
        {
            "name": "Акт приймання-передачі",
            "category": "Документообіг",
            "structure": {
                "doc_type": "act",
                "description": "Стандартний акт приймання продукції",
                "fields": [
                    {"name": "title", "label": "Назва акту", "type": "text"},
                    {"name": "contract_number", "label": "Номер договору", "type": "text"},
                    {"name": "date_signed", "label": "Дата підписання", "type": "date"},
                    {"name": "receiver", "label": "Одержувач (Компанія)", "type": "text", "placeholder": "Напр: ТОВ Сильпо"},
                    {"name": "handed_over", "label": "Здав (ПІБ посадовця)", "type": "text"},
                    {"name": "received_by", "label": "Прийняв (ПІБ посадовця)", "type": "text"}
                ],
                "has_cargo_table": True
            }
        }
    ]

    for t_data in templates_data:
        new_tpl = Template(
            name=t_data["name"], 
            category=t_data["category"], 
            structure=t_data["structure"]
        )
        db.add(new_tpl)
    
    db.commit()
    return {"message": "Успішно оновлено шаблони у PostgreSQL!"}
@app.get("/templates/")
def get_templates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    templates = db.query(Template).filter(Template.is_active == True).all()
    result = []
    for t in templates:
        t_dict = t.__dict__.copy()
        t_dict["id"] = str(t.id)
        result.append(t_dict)
    return result
# --- ЗАХИЩЕНІ МАРШРУТИ ДОКУМЕНТІВ ТА ПІДПИСІВ ---
class CargoItemCreate(BaseModel):
    name: str
    unit: str = "кг"
    quantity: int
    price: float
    weight: float

class DocumentCreate(BaseModel):
    title: str
    doc_type: str
    contractor_id: Optional[str] = None
    carrier: Optional[str] = None
    sender: Optional[str] = "ТОВ «ЗЕРНАРІ»"
    receiver: Optional[str] = None
    load_point: Optional[str] = None
    unload_point: Optional[str] = None
    custom_fields: dict = {}
    cargo_items: List[CargoItemCreate] = []

@app.get("/documents/")
def get_all_documents(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Document).order_by(Document.generated_at.desc()).all()

@app.post("/documents/")
def create_document(doc: DocumentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cargo_list = []
    for item in doc.cargo_items:
        cargo_list.append({
            "name": item.name, 
            "unit": item.unit, 
            "quantity": item.quantity, 
            "price": item.price, 
            "weight": item.weight
        })
    
    dynamic_data_json = {
        "title": doc.title, 
        "doc_type": doc.doc_type, 
        "carrier": doc.carrier, 
        "sender": doc.sender, 
        "receiver": doc.receiver, 
        "load_point": doc.load_point, 
        "unload_point": doc.unload_point, 
        "cargo_items": cargo_list
    }
    
    dynamic_data_json.update(doc.custom_fields)
    
    new_doc = Document(
        user_id=current_user.id, 
        contractor_id=doc.contractor_id,
        title=doc.title, 
        doc_type=doc.doc_type, 
        carrier=doc.carrier, 
        sender=doc.sender, 
        receiver=doc.receiver, 
        load_point=doc.load_point, 
        unload_point=doc.unload_point, 
        dynamic_data=dynamic_data_json
    )
    
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    
    log_audit(db, current_user.id, "Створення документа", f"Тип: {doc.doc_type}, Назва: {doc.title}")
    return {"message": "Документ збережено!", "document_id": str(new_doc.id)}

@app.post("/documents/{doc_id}/sign")
def sign_document(doc_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не знайдено")
    if doc.status == "signed":
        return {"message": "Документ вже підписано"}

    new_sig = Signature(
        document_id=doc.id, 
        user_id=current_user.id, 
        signature_type="Електронний цифровий підпис"
    )
    db.add(new_sig)
    
    doc.status = "signed"
    db.commit()
    
    log_audit(db, current_user.id, "Підписання документа", f"ID документа: {str(doc.id)[:8]}")
    return {"message": "Документ успішно підписано!"}

# --- УНІВЕРСАЛЬНА ГЕНЕРАЦІЯ PDF З ПІДТРИМКОЮ ПЕРЕГЛЯДУ ТА ЗАВАНТАЖЕННЯ ---
@app.get("/generate_pdf/{doc_id}")
def generate_pdf(doc_id: str, action: str = "view", db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc: 
        return {"error": "Документ не знайдено!"}

    sig = db.query(Signature).filter(Signature.document_id == doc.id).first()
    signer_info = None
    if sig:
        user = db.query(User).filter(User.id == sig.user_id).first()
        if user:
            signer_info = {
                "name": user.full_name,
                "position": user.position,
                "date": sig.signed_at.strftime("%d.%m.%Y %H:%M"),
                "type": sig.signature_type,
                "id": str(sig.id)[:18].upper()
            }

    import platform
    
    if platform.system() == "Windows":
        path_wkhtmltopdf = r'C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe'
        config = pdfkit.configuration(wkhtmltopdf=path_wkhtmltopdf)
    else:
        config = pdfkit.configuration(wkhtmltopdf='/usr/bin/wkhtmltopdf')
    template_file = f"{doc.doc_type}_template.html"
    template = jinja2.Environment(loader=jinja2.FileSystemLoader("./templates_pdf")).get_template(template_file)

    data = doc.dynamic_data
    cargo = data.get("cargo_items", [])
    
    context = {
        "doc_number": str(doc.id)[:8].upper(),
        "date": doc.generated_at.strftime("%d.%m.%Y %H:%M") if doc.generated_at else "",
        "data": data,
        "cargo_items": cargo,
        "total_quantity": sum(i.get("quantity", 0) for i in cargo),
        "total_price": round(sum(i.get("price", 0.0) for i in cargo), 2),
        "total_weight": round(sum(i.get("weight", 0.0) for i in cargo), 3),
        "signer": signer_info
    }

    pdf_path = f"{doc.doc_type}_{doc_id}.pdf"
    pdfkit.from_string(template.render(context), pdf_path, configuration=config, options={"enable-local-file-access": ""})
    
    if action == "download":
        return FileResponse(pdf_path, media_type='application/pdf', filename=pdf_path)
    else:
        return FileResponse(pdf_path, media_type='application/pdf', headers={"Content-Disposition": f"inline; filename={pdf_path}"})