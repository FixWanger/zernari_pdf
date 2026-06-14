import uuid
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database.db import Base

class Department(Base):
    __tablename__ = "departments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    users = relationship("User", back_populates="department")

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String(150), nullable=False)
    email = Column(String(100), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="user")
    position = Column(String(100), nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    department = relationship("Department", back_populates="users")
    documents = relationship("Document", back_populates="user")
    signatures = relationship("Signature", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")

class Template(Base):
    __tablename__ = "templates"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(150), nullable=False)
    category = Column(String(50), nullable=False)
    structure = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, nullable=False, default=True)
    documents = relationship("Document", back_populates="template")

class Contractor(Base):
    __tablename__ = "contractors"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    legal_name = Column(String(200), nullable=False)
    edrpou = Column(String(10), nullable=False, unique=True)
    address = Column(String(255), nullable=True)
    contacts = Column(String(150), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True) # Додано поле статусу
    documents = relationship("Document", back_populates="contractor")

class Document(Base):
    __tablename__ = "documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    template_id = Column(UUID(as_uuid=True), ForeignKey("templates.id"), nullable=True)
    contractor_id = Column(UUID(as_uuid=True), ForeignKey("contractors.id"), nullable=True)
    title = Column(String(255), nullable=True)
    doc_type = Column(String(50), nullable=True)
    dynamic_data = Column(JSONB, nullable=False)
    file_path = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="generated")
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Специфічні поля (для сумісності з формою)
    carrier = Column(String, nullable=True)
    sender = Column(String, nullable=True)
    receiver = Column(String, nullable=True)
    load_point = Column(String, nullable=True)
    unload_point = Column(String, nullable=True)
    
    user = relationship("User", back_populates="documents")
    template = relationship("Template", back_populates="documents")
    contractor = relationship("Contractor", back_populates="documents")
    signatures = relationship("Signature", back_populates="document")

class Signature(Base):
    __tablename__ = "signatures"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    signature_type = Column(String(50), nullable=False)
    signed_at = Column(DateTime(timezone=True), server_default=func.now())
    document = relationship("Document", back_populates="signatures")
    user = relationship("User", back_populates="signatures")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    user = relationship("User", back_populates="audit_logs")