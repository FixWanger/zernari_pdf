import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

const API_URL = 'https://zernari-pdf.onrender.com';

const DEPARTMENTS_DATA = {
  "ІТ-відділ": ["Адміністратор системи", "Помічник фахівця з ІПЗ", "Фахівець із технічної підтримки"],
  "Відділ логістики": ["Керівник відділу логістики", "Старший логіст", "Диспетчер", "Водій"],
  "Виробничо-технічна лабораторія": ["Завідувач лабораторії", "Старший лаборант", "Лаборант-аналітик"],
  "Елеваторне та складське господарство": ["Завідувач складом", "Комірник", "Оператор елеватора"],
  "Адміністративний апарат": ["Керуючий млином", "Головний бухгалтер", "HR-менеджер", "Діловод"],
  "Відділ продажу та маркетингу": ["Комерційний директор", "Менеджер з продажу", "Маркетолог"]
};

// --- КОМПОНЕНТИ АВТОРИЗАЦІЇ ТА НАВІГАЦІЇ ---
function Login({ setAuthToken }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    try {
      const response = await axios.post(`${API_URL}/token`, formData);
      const token = response.data.access_token;
      localStorage.setItem('token', token);
      setAuthToken(token);
    } catch (error) {
      alert('Помилка авторизації! Невірна пошта або пароль.');
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-logo">ZERNARI</div>
        <div className="login-subtitle">Система генерації документації</div>
        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label>Електронна пошта</label>
            <input 
              className="form-input" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="name@zernari.com" 
            />
          </div>
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label>Пароль</label>
            <input 
              className="form-input" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="••••••••" 
            />
          </div>
          <button type="submit" className="login-btn">УВІЙТИ В СИСТЕМУ</button>
        </form>
      </div>
    </div>
  );
}

function Sidebar({ logout, userProfile }) {
  const location = useLocation();
  return (
    <div className="sidebar">
      <div className="sidebar-logo">ZERNARI</div>
      <nav>
        <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
          Каталог шаблонів
        </Link>
        <Link to="/archive" className={`nav-item ${location.pathname === '/archive' ? 'active' : ''}`}>
          Архів документів
        </Link>
        <Link to="/contractors" className={`nav-item ${location.pathname === '/contractors' ? 'active' : ''}`}>
          Контрагенти
        </Link>
        <Link to="/settings" className={`nav-item ${location.pathname === '/settings' ? 'active' : ''}`}>
          Налаштування
        </Link>
        
        {userProfile?.role === 'admin' && (
          <Link to="/audit" className={`nav-item ${location.pathname === '/audit' ? 'active' : ''}`} style={{color: '#ffd700'}}>
            Журнал (Адмін)
          </Link>
        )}

        <button onClick={logout} className="nav-item" style={{ marginTop: '50px', color: '#ff6b6b' }}>
          Вийти з системи
        </button>
      </nav>
    </div>
  );
}

function Catalog({ token, userProfile }) {
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    axios.get(`${API_URL}/templates/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setTemplates(res.data))
      .catch(err => console.error("Помилка завантаження шаблонів", err));
  }, [token]);

  return (
    <div>
      <div className="page-header">
        <h2>Каталог корпоративних документів</h2>
        <span className="user-info">{userProfile?.full_name} ({userProfile?.department})</span>
      </div>
      <div className="catalog-grid">
        {templates.map(tpl => (
          <Link to={`/create/${tpl.id}`} key={tpl.id} className="template-card" state={{ template: tpl }}>
            <div className="template-category">{tpl.category}</div>
            <div className="template-title">{tpl.name}</div>
            <div className="template-desc">{tpl.structure.description}</div>
            <div className="template-btn">Створити документ ➔</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// --- КОМПОНЕНТ КОНТРАГЕНТІВ ---
function Contractors({ token, userProfile }) {
  const [contractors, setContractors] = useState([]);
  const [legalName, setLegalName] = useState('');
  const [edrpou, setEdrpou] = useState('');

  const fetchContractors = () => {
    axios.get(`${API_URL}/contractors/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setContractors(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => { 
    fetchContractors(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/contractors/`, { legal_name: legalName, edrpou }, { headers: { Authorization: `Bearer ${token}` } });
      alert('Контрагента успішно додано!');
      setLegalName(''); 
      setEdrpou(''); 
      fetchContractors();
    } catch (err) { 
      alert('Помилка збереження'); 
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Довідник Контрагентів</h2>
        <span className="user-info">{userProfile?.full_name}</span>
      </div>
      <div className="form-card" style={{ marginBottom: '30px' }}>
        <h3>Додати контрагента</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
          <div className="form-group" style={{flex: 2}}>
            <label>Назва компанії (Юр. особа)</label>
            <input 
              className="form-input" 
              required 
              value={legalName} 
              onChange={e => setLegalName(e.target.value)} 
              placeholder="ТОВ АТБ-Маркет"
            />
          </div>
          <div className="form-group" style={{flex: 1}}>
            <label>Код ЄДРПОУ</label>
            <input 
              className="form-input" 
              required 
              value={edrpou} 
              onChange={e => setEdrpou(e.target.value)} 
              placeholder="12345678"
            />
          </div>
          <button type="submit" className="btn-submit" style={{ flex: 1, marginTop: 0 }}>Додати</button>
        </form>
      </div>
      <table className="archive-table">
        <thead>
          <tr>
            <th>Назва контрагента</th>
            <th>ЄДРПОУ</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {contractors.map(c => (
            <tr key={c.id}>
              <td style={{ fontWeight: 'bold' }}>{c.legal_name}</td>
              <td>{c.edrpou}</td>
              <td><span className="status-badge" style={{backgroundColor: '#c3e6cb', color: '#155724'}}>Активний</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- КОМПОНЕНТ АУДИТУ ---
function AuditLogs({ token, userProfile }) {
  const [logs, setLogs] = useState([]);
  
  useEffect(() => {
    axios.get(`${API_URL}/audit-logs/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setLogs(res.data))
      .catch(err => console.error(err));
  }, [token]);

  return (
    <div>
      <div className="page-header">
        <h2>Журнал дій користувачів (Аудит)</h2>
        <span className="user-info">{userProfile?.full_name}</span>
      </div>
      <table className="archive-table">
        <thead>
          <tr>
            <th>Дата та Час</th>
            <th>Користувач</th>
            <th>Дія</th>
            <th>Деталі</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td style={{ fontSize: '13px', color: '#666' }}>{log.timestamp}</td>
              <td style={{ fontWeight: 'bold' }}>{log.user_name}</td>
              <td>
                <span className="status-badge" style={{backgroundColor: '#e2e3e5', color: '#383d41'}}>
                  {log.action}
                </span>
              </td>
              <td style={{ fontSize: '13px' }}>{log.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- ДИНАМІЧНА ФОРМА ---
function DynamicDocumentForm({ token, userProfile }) {
  const location = useLocation();
  const template = location.state?.template;
  
  const [formData, setFormData] = useState({});
  const [cargoItems, setCargoItems] = useState([{ name: '', unit: 'кг', quantity: '', price: '', weight: '' }]);
  const [docId, setDocId] = useState(null);
  
  const [contractors, setContractors] = useState([]);
  const [selectedContractor, setSelectedContractor] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/contractors/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setContractors(res.data))
      .catch(err => console.log(err));
  }, [token]);

  if (!template) {
    return <div>Помилка: Шаблон не знайдено. Поверніться до каталогу.</div>;
  }

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleContractorChange = (e) => {
    const selectedId = e.target.value;
    setSelectedContractor(selectedId);
    
    if (selectedId) {
      const contractor = contractors.find(c => c.id === selectedId);
      if (contractor) {
        setFormData(prev => ({
          ...prev,
          receiver: contractor.legal_name 
        }));
      }
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...cargoItems];
    newItems[index][field] = value;
    setCargoItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formattedItems = template.structure.has_cargo_table ? cargoItems.map(item => ({
      name: item.name, 
      unit: item.unit, 
      quantity: item.quantity ? parseInt(item.quantity) : 0, 
      price: item.price ? parseFloat(item.price) : 0.0, 
      weight: item.weight ? parseFloat(item.weight) : 0.0
    })) : [];

    try {
      const response = await axios.post(`${API_URL}/documents/`, {
        title: formData.title || template.name,
        doc_type: template.structure.doc_type,
        contractor_id: selectedContractor || null,
        carrier: formData.carrier || null,
        sender: formData.sender || 'ТОВ «ЗЕРНАРІ»',
        receiver: formData.receiver || null,
        load_point: formData.load_point || null,
        unload_point: formData.unload_point || null,
        custom_fields: formData,
        cargo_items: formattedItems
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocId(response.data.document_id);
      alert('Документ успішно збережено в безпечну базу!');
    } catch (error) {
      alert('Помилка збереження документа!');
    }
  };

  return (
    <div>
      <Link to="/" className="btn-back">← Повернутися до каталогу</Link>
      <div className="page-header">
        <h2>Створення: {template.name}</h2>
        <span className="user-info">{userProfile?.full_name} ({userProfile?.department})</span>
      </div>
      <div className="form-card">
        <form onSubmit={handleSubmit}>
          
          <div className="form-row" style={{ marginBottom: '20px', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '4px' }}>
            <div className="form-group" style={{ width: '100%' }}>
              <label>📎 Прив'язати контрагента (опціонально):</label>
              <select 
                className="form-input" 
                value={selectedContractor} 
                onChange={handleContractorChange} 
              >
                <option value="">-- Не обрано --</option>
                {contractors.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.legal_name} (ЄДРПОУ: {c.edrpou})
                  </option>
                ))}
              </select>
              <small style={{color: '#666', marginTop: '5px', display: 'block'}}>
                * Вибір контрагента автоматично заповнить поле "Одержувач"
              </small>
            </div>
          </div>

          <div className="form-row" style={{ flexWrap: 'wrap' }}>
            {template.structure.fields.map((field, idx) => (
              <div className="form-group" key={idx} style={{ minWidth: '45%' }}>
                <label>{field.label}:</label>
                <input 
                  className="form-input" 
                  type={field.type} 
                  name={field.name}
                  placeholder={field.placeholder || ''}
                  value={formData[field.name] !== undefined ? formData[field.name] : (field.default || '')} 
                  onChange={handleInputChange}
                  required={field.name === 'title'}
                />
              </div>
            ))}
          </div>

          {template.structure.has_cargo_table && (
            <div style={{ marginTop: '20px', borderTop: '2px dashed #ccc', paddingTop: '15px' }}>
              <h3 style={{ marginBottom: '15px', fontSize: '16px' }}>Специфікація вантажу/продукції:</h3>
              {cargoItems.map((item, index) => (
                <div key={index} style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                  <input className="form-input" type="text" placeholder="Назва вантажу" value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} required style={{ flex: 3 }}/>
                  <input className="form-input" type="number" placeholder="К-сть" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} required style={{ flex: 1 }}/>
                  <input className="form-input" type="number" step="0.01" placeholder="Ціна" value={item.price} onChange={(e) => handleItemChange(index, 'price', e.target.value)} style={{ flex: 1 }}/>
                  <input className="form-input" type="number" step="0.001" placeholder="Вага (т)" value={item.weight} onChange={(e) => handleItemChange(index, 'weight', e.target.value)} style={{ flex: 1 }}/>
                </div>
              ))}
              <button 
                type="button" 
                onClick={() => setCargoItems([...cargoItems, { name: '', unit: 'кг', quantity: '', price: '', weight: '' }])} 
                style={{ padding: '8px 15px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                + Додати рядок
              </button>
            </div>
          )}

          <button type="submit" className="btn-submit" style={{ marginTop: '20px' }}>
            Зберегти та згенерувати
          </button>
        </form>

        {docId && (
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#d4edda', borderRadius: '4px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '20px' }}>
            <a href={`${API_URL}/generate_pdf/${docId}?action=view`} target="_blank" rel="noopener noreferrer" className="action-link" style={{ color: '#155724', fontWeight: 'bold', textDecoration: 'none' }}>
              👁️ Переглянути PDF
            </a>
            <a href={`${API_URL}/generate_pdf/${docId}?action=download`} className="action-link" style={{ color: '#0056b3', fontWeight: 'bold', textDecoration: 'none' }}>
              💾 Завантажити PDF
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function Archive({ token, userProfile }) {
  const [documents, setDocuments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const fetchDocuments = () => {
    axios.get(`${API_URL}/documents/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setDocuments(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSignDocument = async (docId) => {
    try {
      await axios.post(`${API_URL}/documents/${docId}/sign`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Документ успішно підписано цифровим підписом!');
      fetchDocuments();
    } catch (error) {
      alert('Помилка підписання документа!');
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const searchLower = searchTerm.toLowerCase();
    const docTitle = (doc.dynamic_data?.title || doc.title || 'Без назви').toLowerCase();
    const docId = doc.id.substring(0, 8).toLowerCase();
    const docStatus = doc.status === 'signed' ? 'підписано' : 'очікує підпису';
    
    return docTitle.includes(searchLower) || docId.includes(searchLower) || docStatus.includes(searchLower);
  });

  return (
    <div>
      <div className="page-header">
        <h2>Архів документів</h2>
        <span className="user-info">{userProfile?.full_name} ({userProfile?.department})</span>
      </div>

      <div className="search-container">
        <span className="search-icon">🔍</span>
        <input 
          type="text" 
          className="search-input" 
          placeholder="Пошук документа за назвою, ID або статусом..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <table className="archive-table">
        <thead>
          <tr>
            <th>ID Документа</th>
            <th>Назва</th>
            <th>Дата створення</th>
            <th>Статус</th>
            <th>Дії</th>
          </tr>
        </thead>
        <tbody>
          {filteredDocuments.length > 0 ? (
            filteredDocuments.map(doc => (
              <tr key={doc.id}>
                <td style={{ fontSize: '12px', color: '#888' }}>{doc.id.substring(0, 8).toUpperCase()}</td>
                <td style={{ fontWeight: 'bold' }}>{doc.dynamic_data?.title || doc.title || 'Без назви'}</td>
                <td>{new Date(doc.generated_at).toLocaleString('uk-UA')}</td>
                <td>
                  {doc.status === 'signed' ? (
                    <span className="status-badge" style={{backgroundColor: '#c3e6cb', color: '#155724'}}>✍️ Підписано</span>
                  ) : (
                    <span className="status-badge" style={{backgroundColor: '#ffeeba', color: '#856404'}}>⏳ Очікує підпису</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <a href={`${API_URL}/generate_pdf/${doc.id}?action=view`} target="_blank" rel="noopener noreferrer" className="action-link" style={{textDecoration: 'none'}} title="Переглянути PDF">
                      👁️ Перегляд
                    </a>
                    <a href={`${API_URL}/generate_pdf/${doc.id}?action=download`} className="action-link" style={{textDecoration: 'none'}} title="Завантажити на пристрій">
                      💾 Завантажити
                    </a>
                    {doc.status !== 'signed' && (
                      <button 
                        onClick={() => handleSignDocument(doc.id)} 
                        style={{padding: '6px 12px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'}}
                      >
                        Підписати
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                За вашим запитом нічого не знайдено 🕵️‍♂️
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Settings({ userProfile, token }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const initialDept = Object.keys(DEPARTMENTS_DATA)[0];
  const [deptName, setDeptName] = useState(initialDept);
  const [position, setPosition] = useState(DEPARTMENTS_DATA[initialDept][0]);
  
  const [usersList, setUsersList] = useState([]);

  const fetchUsers = () => {
    if (userProfile?.role === 'admin') {
      axios.get(`${API_URL}/users/`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setUsersList(res.data))
        .catch(err => console.error(err));
    }
  };

  useEffect(() => { 
    fetchUsers(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile, token]);

  const handleDeptChange = (e) => {
    const newDept = e.target.value;
    setDeptName(newDept);
    setPosition(DEPARTMENTS_DATA[newDept][0]);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/users/`, { 
        full_name: fullName, 
        email, 
        password, 
        role, 
        position, 
        department_name: deptName 
      }, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      alert(`Співробітника ${fullName} успішно додано в систему!`);
      setFullName(''); 
      setEmail(''); 
      setPassword(''); 
      setDeptName(initialDept); 
      setPosition(DEPARTMENTS_DATA[initialDept][0]);
      fetchUsers(); 
    } catch (error) { 
      alert(error.response?.data?.detail || 'Помилка при створенні користувача!'); 
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Ви дійсно хочете видалити співробітника ${userEmail}?`)) return;
    try {
      await axios.delete(`${API_URL}/users/${userId}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      alert('Користувача успішно видалено!');
      fetchUsers(); 
    } catch (error) {
      alert(error.response?.data?.detail || 'Помилка видалення!');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Налаштування профілю та системи</h2>
        <span className="user-info">{userProfile?.full_name} ({userProfile?.department})</span>
      </div>
      
      <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', marginBottom: '30px' }}>
        <div className="form-card" style={{ flex: 1, minWidth: '320px' }}>
          <h3>Особисті дані</h3>
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label>ПІБ:</label>
            <input className="form-input" type="text" value={userProfile?.full_name || ''} disabled style={{ backgroundColor: '#e9ecef' }} />
          </div>
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label>Посада:</label>
            <input className="form-input" type="text" value={userProfile?.position || ''} disabled style={{ backgroundColor: '#e9ecef' }} />
          </div>
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label>Підрозділ:</label>
            <input className="form-input" type="text" value={userProfile?.department || ''} disabled style={{ backgroundColor: '#e9ecef' }} />
          </div>
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label>Електронна пошта:</label>
            <input className="form-input" type="text" value={userProfile?.email || ''} disabled style={{ backgroundColor: '#e9ecef' }} />
          </div>
          <div style={{ marginTop: '15px', color: '#666', fontSize: '13px' }}>
            Роль у системі: <strong style={{ color: '#245c47' }}>{userProfile?.role?.toUpperCase()}</strong>
          </div>
        </div>
        
        {userProfile?.role === 'admin' && (
          <div className="form-card" style={{ flex: 1, minWidth: '350px', borderTop: '4px solid #245c47' }}>
            <h3>🛠️ Панель управління користувачами</h3>
            <form onSubmit={handleCreateUser}>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label>Повне ім'я (ПІБ):</label>
                <input className="form-input" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Коваленко Олександр Олегович" />
              </div>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label>Корпоративний Email:</label>
                <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="kovalenko@zernari.com" />
              </div>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label>Тимчасовий пароль:</label>
                <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Мінімум 6 символів" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Підрозділ:</label>
                  <select className="form-input" value={deptName} onChange={handleDeptChange}>
                    {Object.keys(DEPARTMENTS_DATA).map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Посада:</label>
                  <select className="form-input" value={position} onChange={(e) => setPosition(e.target.value)}>
                    {DEPARTMENTS_DATA[deptName].map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Роль доступу:</label>
                <select className="form-input" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="user">Звичайний користувач (User)</option>
                  <option value="admin">Адміністратор системи (Admin)</option>
                </select>
              </div>
              <button type="submit" className="btn-submit" style={{ backgroundColor: '#245c47' }}>
                Зареєструвати співробітника
              </button>
            </form>
          </div>
        )}
      </div>

      {userProfile?.role === 'admin' && (
        <div className="form-card" style={{ width: '100%', borderTop: '4px solid #ff6b6b' }}>
          <h3>👥 Управління зареєстрованими співробітниками</h3>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
            Увага: видалення співробітника неможливе, якщо він вже створив або підписав документи (для збереження цілісності архіву).
          </p>
          <table className="archive-table">
            <thead>
              <tr>
                <th>ПІБ</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Підрозділ</th>
                <th>Посада</th>
                <th>Дії</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map(user => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 'bold' }}>{user.full_name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className="status-badge" style={{backgroundColor: user.role === 'admin' ? '#ffeeba' : '#e2e3e5', color: user.role === 'admin' ? '#856404' : '#383d41'}}>
                      {user.role.toUpperCase()}
                    </span>
                  </td>
                  <td>{user.department}</td>
                  <td>{user.position}</td>
                  <td>
                    <button 
                      onClick={() => handleDeleteUser(user.id, user.email)} 
                      style={{ padding: '6px 12px', backgroundColor: '#ff4d4d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      🗑️ Видалити
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    if (token) {
      axios.get(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setUserProfile(res.data))
        .catch(err => { console.error(err); logout(); });
    }
  }, [token]);

  const logout = () => { 
    localStorage.removeItem('token'); 
    setToken(null); 
    setUserProfile(null); 
  };

  if (!token) return <Login setAuthToken={setToken} />;

  return (
    <Router>
      <div className="app-container">
        <Sidebar logout={logout} userProfile={userProfile} />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Catalog token={token} userProfile={userProfile} />} />
            <Route path="/create/:id" element={<DynamicDocumentForm token={token} userProfile={userProfile} />} />
            <Route path="/archive" element={<Archive token={token} userProfile={userProfile} />} />
            <Route path="/contractors" element={<Contractors token={token} userProfile={userProfile} />} />
            <Route path="/audit" element={<AuditLogs token={token} userProfile={userProfile} />} />
            <Route path="/settings" element={<Settings token={token} userProfile={userProfile} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;