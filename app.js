function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const WA_NUMBER = '595983996807';
const BUSINESS_HOURS = { open: 9, close: 19 }; // 9:00 a 19:30
const SLOT_INTERVAL = 30; // minutos


// Turnos ocupados (simulados + localStorage)
function getBookedSlots(dateStr) {
  const stored = JSON.parse(localStorage.getItem('nails_booked_' + dateStr) || '[]');
  return stored;
}

function getReservations(dateStr) {
  return JSON.parse(localStorage.getItem('nails_reservations_' + dateStr) || '[]');
}

function getSlotCapacity(dateStr, timeStr) {
  const capacities = JSON.parse(localStorage.getItem('nails_capacity_' + dateStr) || '{}');
  if (capacities[timeStr] !== undefined && capacities[timeStr] !== null && capacities[timeStr] !== '') {
    return parseInt(capacities[timeStr]);
  }
  return parseInt(localStorage.getItem('nails_default_capacity') || '3'); // Por defecto 3
}

function isSlotBooked(dateStr, timeStr) {
  const booked = getBookedSlots(dateStr);
  if (booked.includes(timeStr)) return true;

  const res = getReservations(dateStr).filter(r => r.time === timeStr);
  const cap = getSlotCapacity(dateStr, timeStr);
  return res.length >= cap;
}

function bookSlot(dateStr, timeStr, clientName, service, clientPhone, staff) {
  // Guardar datos completos de la reserva para el anotador del admin
  const key = 'nails_reservations_' + dateStr;
  const reservations = JSON.parse(localStorage.getItem(key) || '[]');
  const entry = {
    time: timeStr,
    name: clientName || 'Cliente',
    phone: clientPhone || '',
    service: service || 'Servicio no especificado',
    staff: staff || 'Cualquiera',
    bookedAt: new Date().toLocaleString('es-PY', { hour12: false })
  };
  reservations.push(entry);
  reservations.sort((a, b) => a.time.localeCompare(b.time));
  localStorage.setItem(key, JSON.stringify(reservations));
}

// Helper para leer el horario del día
function parseTimeRange(timeStr) {
  if (!timeStr || timeStr.toLowerCase().includes('cerrado')) return null;
  const parts = timeStr.split(/[-–]/).map(s => s.trim());
  if (parts.length !== 2) return null;
  const open = parts[0].split(':').map(Number);
  const close = parts[1].split(':').map(Number);
  if (open.length !== 2 || close.length !== 2 || isNaN(open[0]) || isNaN(close[0])) return null;
  return { openHour: open[0], openMin: open[1], closeHour: close[0], closeMin: close[1] };
}

function getDaySchedule(dayOfWeek) {
  const map = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const dayStr = map[dayOfWeek];
  const set = window.globalSettings || getDefaultSettings();
  const timeStr = set.scheduleMap[dayStr];
  return parseTimeRange(timeStr);
}

// Generar slots del día
function generateSlots(sched) {
  const slots = [];
  if (!sched) return slots;
  
  let h = sched.openHour;
  let m = sched.openMin;
  
  while (h < sched.closeHour || (h === sched.closeHour && m <= sched.closeMin)) {
    slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    m += SLOT_INTERVAL;
    if (m >= 60) {
      h++;
      m -= 60;
    }
  }
  return slots;
}

// Llenar select de horarios
function fillTimeSlots(dateStr) {
  const select = document.getElementById('timeInput');
  select.innerHTML = '<option value="">-- Elegí hora --</option>';
  
  const d = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = d.getDay(); // 0=Dom, 6=Sab
  
  const sched = getDaySchedule(dayOfWeek);
  if (!sched) {
    select.innerHTML = '<option value="">❌ Cerrado</option>';
    return;
  }
  
  const slots = generateSlots(sched);
  const booked = getBookedSlots(dateStr);
  const reservations = getReservations(dateStr);
  
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const isToday = dateStr === todayStr;
  
  slots.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    const resCount = reservations.filter(r => r.time === s).length;
    const cap = getSlotCapacity(dateStr, s);
    const isManuallyBlocked = booked.includes(s);
    const isFull = isManuallyBlocked || resCount >= cap;
    const isPast = isToday && new Date(dateStr + 'T' + s + ':00') <= now;
    
    if (isPast) {
      opt.textContent = `${s} - ❌ Pasado`;
      opt.disabled = true;
    } else if (isManuallyBlocked) {
      opt.textContent = `${s} - ❌ Bloqueado`;
      opt.disabled = true;
    } else if (isFull) {
      opt.textContent = `${s} - ❌ Ocupado (${resCount}/${cap})`;
      opt.disabled = true;
    } else {
      opt.textContent = `${s} - ✅ Disponible (${resCount}/${cap})`;
    }
    select.appendChild(opt);
  });
}

// Mostrar slots de la fecha seleccionada
function renderSlotsForDate(dateStr) {
  const grid = document.getElementById('slotsGrid');
  if (!grid) return;
  
  const d = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = d.getDay();
  
  const titleSpan = document.querySelector('.slots-section h3 span');
  
  if (titleSpan) {
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    titleSpan.textContent = dayNames[dayOfWeek];
  }

  const sched = getDaySchedule(dayOfWeek);
  if (!sched) {
    grid.innerHTML = '<p style="color:#ef4444;font-size:14px;grid-column:1/-1;text-align:center;">El salón está cerrado este día 🚫</p>';
    return;
  }
  
  const slots = generateSlots(sched);
  const booked = getBookedSlots(dateStr);
  const reservations = getReservations(dateStr);
  
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const isToday = dateStr === todayStr;

  grid.innerHTML = '';
  if (slots.length === 0) {
    grid.innerHTML = '<p style="color:#888;font-size:14px;grid-column:1/-1;text-align:center;">No quedan turnos disponibles para este día.</p>';
    return;
  }
  
  slots.forEach(s => {
    const pill = document.createElement('div');
    const resCount = reservations.filter(r => r.time === s).length;
    const cap = getSlotCapacity(dateStr, s);
    const isManuallyBlocked = booked.includes(s);
    const isFull = isManuallyBlocked || resCount >= cap;
    const isPast = isToday && new Date(dateStr + 'T' + s + ':00') <= now;
    
    if (isPast) {
      pill.className = 'slot-pill past';
      pill.textContent = `${s} (Pasado)`;
      pill.title = 'Este turno ya pasó';
    } else {
      pill.className = 'slot-pill ' + (isFull ? 'taken' : 'avail');
      pill.textContent = isFull ? `${s} (Lleno)` : `${s} (${resCount}/${cap})`;
      if (!isFull) {
        pill.title = 'Click para pre-seleccionar';
        pill.onclick = () => {
          document.getElementById('dateInput').value = dateStr;
          document.getElementById('timeInput').value = s;
          fillTimeSlots(dateStr);
          setTimeout(() => { document.getElementById('timeInput').value = s; }, 100);
          document.getElementById('turnos').scrollIntoView({ behavior: 'smooth' });
        };
      }
    }
    grid.appendChild(pill);
  });
}

// Verificar disponibilidad
function checkAvailability() {
  const name = document.getElementById('clientName').value.trim();
  const phone = document.getElementById('clientPhone').value.trim();
  const service = document.getElementById('serviceSelect').value;
  const staff = document.getElementById('staffSelect').value;
  const date = document.getElementById('dateInput').value;
  const time = document.getElementById('timeInput').value;
  const result = document.getElementById('bookingResult');
  
  if (!name) { alert('Por favor ingresá tu nombre 👤'); return; }
  if (!phone) { alert('Por favor ingresá tu teléfono 📱'); return; }
  if (!date) { alert('Seleccioná una fecha 📅'); return; }
  if (!time) { alert('Seleccioná un horario ⏰'); return; }
  
  const dateObj = new Date(date + 'T00:00:00');
  const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const dayOfWeek = dateObj.getDay();
  
  if (dayOfWeek === 0) {
    result.innerHTML = `<div class="result-unavailable"><span class="status-badge-na">CERRADO</span><h3>Domingo cerrado</h3><p>No atendemos los domingos. Elegí de lunes a sábado.</p></div>`;
    return;
  }

  const formattedDate = `${dayNames[dayOfWeek]} ${dateObj.getDate()} de ${monthNames[dateObj.getMonth()]}`;

  if (isSlotBooked(date, time)) {
    const waMsg = encodeURIComponent(`Hola Vero's Nails! 💅 Soy ${name}. El turno del ${formattedDate} a las ${time} para ${service} con ${staff} ya está ocupado. ¿Pueden decirme los turnos disponibles ese día?`);
    result.innerHTML = `
      <div class="result-unavailable">
        <span class="status-badge-na">❌ NO DISPONIBLE</span>
        <h3>Turno Ocupado</h3>
        <p>${formattedDate} a las <strong>${time}</strong> ya está reservado.<br>Consultá por WhatsApp para ver otros horarios.</p>
        <a href="https://wa.me/${WA_NUMBER}?text=${waMsg}" target="_blank" class="btn-wa-alt">
          <i class="fab fa-whatsapp"></i> Ver otros turnos por WhatsApp
        </a>
      </div>`;
  } else {
    const waMsg = encodeURIComponent(`Hola Vero's Nails! 💅 Quiero reservar un turno:\n\n👤 Nombre: ${name}\n📱 Teléfono: ${phone}\n✂️ Servicio: ${service}\n💅 Manicurista: ${staff}\n📅 Fecha: ${formattedDate}\n⏰ Hora: ${time}\n\n¿Pueden confirmarme la reserva?`);
    result.innerHTML = `
      <div class="result-available">
        <span class="status-badge">✅ DISPONIBLE</span>
        <h3>Turno Disponible</h3>
        <div class="slot-time">${time}</div>
        <div class="slot-service">${formattedDate} · ${service}</div>
        <a href="https://wa.me/${WA_NUMBER}?text=${waMsg}" target="_blank" class="btn-wa-book" onclick="confirmBook('${date}','${time}')">
          <i class="fab fa-whatsapp"></i> Confirmar por WhatsApp
        </a>
      </div>`;
  }
}

function confirmBook(date, time) {
  const name = document.getElementById('clientName')?.value?.trim() || 'Cliente';
  const phone = document.getElementById('clientPhone')?.value?.trim() || '';
  const service = document.getElementById('serviceSelect')?.value || 'Servicio';
  const staff = document.getElementById('staffSelect')?.value || 'Cualquiera';
  bookSlot(date, time, name, service, phone, staff);
  setTimeout(() => {
    renderSlotsForDate(date);
    // Vuelve a la normalidad
    const resultDiv = document.getElementById('bookingResult');
    if (resultDiv) {
      resultDiv.innerHTML = `
        <div class="result-idle">
          <i class="fas fa-calendar-check idle-icon"></i>
          <p>Seleccioná fecha y hora para verificar disponibilidad</p>
        </div>
      `;
    }
    if (document.getElementById('clientName')) document.getElementById('clientName').value = '';
    if (document.getElementById('clientPhone')) document.getElementById('clientPhone').value = '';
    if (document.getElementById('timeInput')) document.getElementById('timeInput').value = '';
  }, 500);
}

// Navbar scroll
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 60);
});

// Toggle menú móvil
function toggleMenu() {
  document.getElementById('mobileMenu').classList.toggle('open');
}

// Fecha mínima = hoy
window.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('dateInput');
  dateInput.min = today;
  dateInput.value = today;
  dateInput.addEventListener('change', e => {
    fillTimeSlots(e.target.value);
    renderSlotsForDate(e.target.value);
  });
  fillTimeSlots(today);
  renderSlotsForDate(today);
  
  // Inicializar Slider Hero
  initSlider();
  
  // Animación de entrada para secciones
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.style.opacity = '1'; e.target.style.transform = 'translateY(0)'; } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.service-card, .promo-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });

  // Poblar staff dinámicamente será manejado por renderDynamicCatalog()
  initDynamicCatalog();

});

function selectService(serviceValue) {
  const select = document.getElementById('serviceSelect');
  if (select) {
    select.value = serviceValue;
  }
  document.getElementById('turnos').scrollIntoView({ behavior: 'smooth' });
}

// ================= HERO SLIDER LOGIC =================
let currentSlideIndex = 0;
let slideInterval;

function initSlider() {
  const slides = document.querySelectorAll('.slide');
  if (slides.length === 0) return;
  
  slides.forEach((s, i) => {
    s.classList.toggle('active', i === currentSlideIndex);
  });
  
  startSlideTimer();
}

function moveSlide(direction) {
  const slides = document.querySelectorAll('.slide');
  if (slides.length === 0) return;
  
  slides[currentSlideIndex].classList.remove('active');
  currentSlideIndex = (currentSlideIndex + direction + slides.length) % slides.length;
  slides[currentSlideIndex].classList.add('active');
  
  // Detener y reiniciar timer al interactuar
  stopSlideTimer();
  startSlideTimer();
}

function startSlideTimer() {
  slideInterval = setInterval(() => {
    moveSlide(1);
  }, 6000); // Rotar cada 6 segundos
}

function stopSlideTimer() {
  clearInterval(slideInterval);
}

// ================= CATÁLOGO DINÁMICO & MODO EDICIÓN =================
const DEFAULT_SERVICES = [
  { id: 's1', title: 'Manicura Rusa', desc: 'Limpieza profunda de cutículas y nivelación con base rubber', price: 'Gs. 50.000', time: '45 min', icon: 'fa-sparkles', badge: '' },
  { id: 's2', title: 'Uñas Esculpidas', desc: 'Esculpidas en acrílico o gel con molde, largo y forma a elección', price: 'Gs. 120.000', time: '90 min', icon: 'fa-gem', badge: 'MÁS POPULAR' },
  { id: 's3', title: 'Kapping Gel', desc: 'Capa acrílica protectora sobre tu uña natural para evitar roturas', price: 'Gs. 80.000', time: '60 min', icon: 'fa-magic', badge: '' },
  { id: 's4', title: 'Pedicura Spa', desc: 'Exfoliación, hidratación profunda, masajes y esmaltado semipermanente', price: 'Gs. 70.000', time: '50 min', icon: 'fa-hot-tub-person', badge: '' },
  { id: 's5', title: 'Nail Art Avanzado', desc: 'Diseños personalizados a mano alzada, pedrería, glitter y efectos', price: 'Gs. 40.000', time: '30 min', icon: 'fa-paint-brush', badge: '' },
  { id: 's6', title: 'Retiro + Nutrición', desc: 'Retiro seguro del esmaltado anterior con torno, más nutrición de uña', price: 'Gs. 30.000', time: '30 min', icon: 'fa-pump-soap', badge: '' }
];

const DEFAULT_PROMOS = [
  { id: 'p1', title: 'Rubber Day', desc: '20% de descuento en Manicura Rusa con Base Rubber o Kapping', price: '¡20% OFF!', time: '', icon: 'fa-percentage', badge: 'MIÉRCOLES', isHot: false },
  { id: 'p2', title: 'Manos + Pies', desc: 'Manicura semipermanente + Pedicura Spa con tarifa unificada', price: 'Gs. 95.000', time: '', icon: 'fa-gift', badge: 'HOT COMBO', isHot: true },
  { id: 'p3', title: 'Sábado de Mimos', desc: 'Cualquier servicio incluye una copa de cortesía (Mimosa o Jugo)', price: 'Bebida Incluida', time: '', icon: 'fa-cocktail', badge: 'CADA SÁBADO', isHot: false }
];

const SUPABASE_URL = 'https://oppcyderpkhcnduqexag.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0sUIqkHzZ8-gfHaoKV9wgw_4xy8hSyT';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function initDynamicCatalog() {
  if (!document.getElementById('servicesGridContainer')) return; // Solo en index.html
  
  try {
    // Check if tables are empty, if so, seed them (optional, but good for first load)
    const { data: srvData } = await supabaseClient.from('rosegold_services').select('id').limit(1);
    if (!srvData || srvData.length === 0) {
      for (const s of DEFAULT_SERVICES) {
        await supabaseClient.from('rosegold_services').insert({
          title: s.title, desc: s.desc, price: s.price, time: s.time, icon: s.icon, badge: s.badge
        });
      }
    }
    
    const { data: promoData } = await supabaseClient.from('rosegold_promos').select('id').limit(1);
    if (!promoData || promoData.length === 0) {
      for (const p of DEFAULT_PROMOS) {
        await supabaseClient.from('rosegold_promos').insert({
          title: p.title, desc: p.desc, price: p.price, icon: p.icon, badge: p.badge, "isHot": p.isHot
        });
      }
    }
    
    await renderDynamicCatalog();
  } catch (err) {
    console.error("Error init catalog", err);
    // Fallback to local
    if (!localStorage.getItem('nails_services_data')) localStorage.setItem('nails_services_data', JSON.stringify(DEFAULT_SERVICES));
    if (!localStorage.getItem('nails_promos_data')) localStorage.setItem('nails_promos_data', JSON.stringify(DEFAULT_PROMOS));
    await renderDynamicCatalogLocal();
  }
}

function populateStaffSelect(staffConfig) {
  const staffGroup = document.getElementById('staffGroup');
  const staffSelect = document.getElementById('staffSelect');
  if (staffSelect) {
    staffSelect.innerHTML = '<option value="Cualquiera">Cualquiera (Turno más rápido)</option>';
    if (staffConfig.length === 0) {
      if (staffGroup) staffGroup.style.display = 'none';
    } else {
      if (staffGroup) staffGroup.style.display = 'block';
      staffConfig.forEach(staff => {
        const opt = document.createElement('option');
        opt.value = staff.name;
        opt.textContent = `${staff.name} (${staff.role})`;
        staffSelect.appendChild(opt);
      });
    }
  }
}

async function renderDynamicCatalog() {
  const isEditMode = localStorage.getItem('nails_edit_mode') === 'true';
  
  // Fetch from Supabase
  let allServices = [];
  let promos = [];
  let services = [];
  let staff = [];
  let portfolio = [];
  
  try {
    const { data: sData } = await supabaseClient.from('rosegold_services').select('*').order('created_at', { ascending: true });
    if (sData) allServices = sData;
    
    const { data: pData } = await supabaseClient.from('rosegold_promos').select('*').order('created_at', { ascending: true });
    if (pData) promos = pData;
    
    // Separar configuraciones, servicios, staff y trabajos del álbum
    services = allServices.filter(s => s.id !== 'settings_global' && s.id !== 'settings_hero' && s.badge !== 'staff' && s.desc !== 'Portfolio Work');
    staff = allServices.filter(s => s.badge === 'staff');
    portfolio = allServices.filter(s => s.desc === 'Portfolio Work');
    
    // Sembrar staff si no hay
    if (staff.length === 0) {
      const defaultStaff = [
        { id: generateUUID(), title: 'Valeria', desc: 'Especialista Acrílico', price: '50', icon: 'fa-user-nurse', badge: 'staff', image: 'logo_veros.png' },
        { id: generateUUID(), title: 'Sofía', desc: 'Especialista Pedicura', price: '40', icon: 'fa-user-nurse', badge: 'staff', image: 'logo_veros.png' }
      ];
      for (const s of defaultStaff) {
        await supabaseClient.from('rosegold_services').insert([s]);
      }
      // Re-fetch
      const { data: refetchSData } = await supabaseClient.from('rosegold_services').select('*').order('created_at', { ascending: true });
      if (refetchSData) {
        allServices = refetchSData;
        services = allServices.filter(s => s.id !== 'settings_global' && s.id !== 'settings_hero' && s.badge !== 'staff' && s.desc !== 'Portfolio Work');
        staff = allServices.filter(s => s.badge === 'staff');
        portfolio = allServices.filter(s => s.desc === 'Portfolio Work');
      }
    }
    
    window.allCatalogItems = allServices;
    window.currentPortfolioData = portfolio;
    window.currentServicesData = services;
    
    // Guardar para uso local (coincidir con admin.html)
    const staffConfig = staff.map(s => ({
      id: s.id,
      name: s.title,
      role: s.desc,
      commission: parseFloat(s.price) || 50,
      image: s.image
    }));
    localStorage.setItem('nails_staff_config', JSON.stringify(staffConfig));
    localStorage.setItem('nails_portfolio_data', JSON.stringify(portfolio));
    
    // Extract global settings
    const settingsObj = allServices.find(s => s.id === 'settings_global');
    if (settingsObj) {
      try {
        window.globalSettings = JSON.parse(settingsObj.title);
        applyGlobalSettings(window.globalSettings);
      } catch(e) {}
    } else {
      window.globalSettings = getDefaultSettings();
      applyGlobalSettings(window.globalSettings);
    }
    
    // Extract hero settings
    const heroSettingsObj = allServices.find(s => s.id === 'settings_hero');
    if (heroSettingsObj) {
      try {
        window.heroSettings = JSON.parse(heroSettingsObj.title);
        applyHeroSettings(window.heroSettings);
      } catch(e) {}
    } else {
      window.heroSettings = getDefaultHeroSettings();
    }
    
    // Guardar copia local por si acaso para el admin
    localStorage.setItem('nails_services_data', JSON.stringify(services));
    localStorage.setItem('nails_promos_data', JSON.stringify(promos));
  } catch (e) {
    console.error("Error loading Supabase catalog, loading local fallback", e);
    return renderDynamicCatalogLocal();
  }
  
  const editSettingsBtn = document.getElementById('editSettingsBtn');
  if (editSettingsBtn) editSettingsBtn.style.display = isEditMode ? 'inline-block' : 'none';
  
  const editHeroBtn = document.getElementById('editHeroBtn');
  if (editHeroBtn) editHeroBtn.style.display = isEditMode ? 'inline-block' : 'none';
  
  const addStaffBtn = document.getElementById('addStaffBtn');
  if (addStaffBtn) addStaffBtn.style.display = isEditMode ? 'inline-block' : 'none';
  
  // Render Services
  const sContainer = document.getElementById('servicesGridContainer');
  if (sContainer) {
    sContainer.innerHTML = '';
    services.forEach(item => {
      const imgPath = item.image;
      const imgHtml = imgPath ? `<img src="${imgPath}" class="service-image" alt="${item.title}">` : `<div class="service-icon"><i class="fas ${item.icon}"></i></div>`;
      const badgeHtml = item.badge ? `<div class="badge">${item.badge}</div>` : '';
      const editBtn = isEditMode ? `
        <button class="edit-overlay-btn" onclick="openEditModal('service', '${item.id}')"><i class="fas fa-pencil-alt"></i> EDITAR</button>
        <button class="edit-overlay-btn" style="left:10px; right:auto; background:rgba(239, 68, 68, 0.9);" onclick="deleteItemDirectly('service', '${item.id}', event)"><i class="fas fa-trash"></i></button>
      ` : '';
      
      const valForSelect = `${item.title} (${item.time || 'Promo'})`;
      
      sContainer.innerHTML += `
        <div class="service-card ${item.badge ? 'featured' : ''}">
          ${editBtn}
          ${badgeHtml}
          ${imgHtml}
          <h3>${item.title}</h3>
          <p>${item.desc}</p>
          <div class="service-price"><span class="rose">${item.price}</span></div>
          ${item.time ? `<div class="service-time"><i class="far fa-clock"></i> ${item.time}</div>` : ''}
          <button class="btn-rose small" onclick="selectService('${valForSelect}')">Reservar</button>
        </div>
      `;
    });
    
    if (isEditMode) {
      sContainer.innerHTML += `
        <div class="add-new-card" onclick="openEditModal('service', 'new')">
          <i class="fas fa-plus-circle"></i>
          <span>Añadir Nuevo Servicio</span>
        </div>
      `;
    }
  }

  // Render Promos
  const pContainer = document.getElementById('promosGridContainer');
  if (pContainer) {
    pContainer.innerHTML = '';
    promos.forEach(item => {
      const imgPath = item.image;
      const imgHtml = imgPath ? `<img src="${imgPath}" class="promo-image" alt="${item.title}">` : `<div class="promo-icon"><i class="fas ${item.icon}"></i></div>`;
      const badgeClass = item.isHot ? 'promo-badge hot' : 'promo-badge';
      const badgeHtml = item.badge ? `<div class="${badgeClass}">${item.badge}</div>` : '';
      const editBtn = isEditMode ? `
        <button class="edit-overlay-btn" onclick="openEditModal('promo', '${item.id}')"><i class="fas fa-pencil-alt"></i> EDITAR</button>
        <button class="edit-overlay-btn" style="left:10px; right:auto; background:rgba(239, 68, 68, 0.9);" onclick="deleteItemDirectly('promo', '${item.id}', event)"><i class="fas fa-trash"></i></button>
      ` : '';
      const cardClass = item.isHot ? 'promo-card rose-card' : 'promo-card';
      
      const valForSelect = `Promo: ${item.title}`;
      
      pContainer.innerHTML += `
        <div class="${cardClass}">
          ${editBtn}
          ${badgeHtml}
          ${imgHtml}
          <h3>${item.title}</h3>
          <p>${item.desc}</p>
          <div class="promo-price">${item.price}</div>
          <button class="btn-rose small" onclick="selectService('${valForSelect}')">Aprovechar</button>
        </div>
      `;
    });
    
    if (isEditMode) {
      pContainer.innerHTML += `
        <div class="add-new-card" style="min-height:220px;" onclick="openEditModal('promo', 'new')">
          <i class="fas fa-plus-circle"></i>
          <span>Añadir Nueva Promo</span>
        </div>
      `;
    }
  }

  // Render Staff
  const staffContainer = document.getElementById('staffGridContainer');
  if (staffContainer) {
    staffContainer.innerHTML = '';
    staff.forEach(item => {
      const imgPath = item.image || 'logo_veros.png';
      const imgHtml = `<img src="${imgPath}" class="service-image" alt="${item.title}" style="height: 280px; object-fit: cover;">`;
      const editBtn = isEditMode ? `
        <button class="edit-overlay-btn" onclick="openEditModal('staff', '${item.id}')"><i class="fas fa-pencil-alt"></i> EDITAR</button>
        <button class="edit-overlay-btn" style="left:10px; right:auto; background:rgba(239, 68, 68, 0.9);" onclick="deleteItemDirectly('staff', '${item.id}', event)"><i class="fas fa-trash"></i></button>
      ` : '';
      
      staffContainer.innerHTML += `
        <div class="service-card" style="padding: 0; display: flex; flex-direction: column; height: 100%;">
          ${editBtn}
          ${imgHtml}
          <h3 style="margin-top: 20px; font-family:'Playfair Display', serif; font-size: 22px; font-weight:700; text-align: center;">${item.title}</h3>
          <p style="color:var(--gray); font-size: 14px; margin-bottom: 20px; text-align: center; padding: 0 16px;">${item.desc}</p>
          <div style="padding: 0 24px 24px 24px; margin-top: auto; display: flex; gap: 10px; justify-content: center;">
            <button class="btn-rose small full" onclick="openPortfolio('${item.id}', '${item.title}')"><i class="fas fa-images"></i> Trabajos</button>
          </div>
        </div>
      `;
    });
    
    if (isEditMode) {
      staffContainer.innerHTML += `
        <div class="add-new-card" onclick="openEditModal('staff', 'new')">
          <i class="fas fa-plus-circle"></i>
          <span>Agregar Personal</span>
        </div>
      `;
    }
  }
  
  // Populate Service Select Dropdown
  const select = document.getElementById('serviceSelect');
  if (select) {
    select.innerHTML = '<option value="">-- Seleccionar --</option>';
    services.forEach(item => {
      const val = `${item.title} (${item.time || 'Promo'})`;
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = `${item.title} - ${item.price}`;
      select.appendChild(opt);
    });
    promos.forEach(item => {
      const val = `Promo: ${item.title}`;
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = `${val} - ${item.price}`;
      select.appendChild(opt);
    });
  }

  // Populate Staff dropdown in booking form
  const staffConfig = staff.map(s => ({ id: s.id, name: s.title, role: s.desc, commission: parseFloat(s.price) || 50 }));
  populateStaffSelect(staffConfig);
}

function renderDynamicCatalogLocal() {
  const isEditMode = localStorage.getItem('nails_edit_mode') === 'true';
  const services = JSON.parse(localStorage.getItem('nails_services_data') || '[]');
  const promos = JSON.parse(localStorage.getItem('nails_promos_data') || '[]');
  const staffConfig = JSON.parse(localStorage.getItem('nails_staff_config') || '[]');
  
  window.currentServicesData = services;
  window.currentPortfolioData = JSON.parse(localStorage.getItem('nails_portfolio_data') || '[]');
  
  // Render services
  const sContainer = document.getElementById('servicesGridContainer');
  if (sContainer) {
    sContainer.innerHTML = '';
    services.forEach(item => {
      const imgPath = item.image;
      const imgHtml = imgPath ? `<img src="${imgPath}" class="service-image" alt="${item.title}">` : `<div class="service-icon"><i class="fas ${item.icon}"></i></div>`;
      const badgeHtml = item.badge ? `<div class="badge">${item.badge}</div>` : '';
      const editBtn = isEditMode ? `
        <button class="edit-overlay-btn" onclick="openEditModal('service', '${item.id}')"><i class="fas fa-pencil-alt"></i> EDITAR</button>
      ` : '';
      const valForSelect = `${item.title} (${item.time || 'Promo'})`;
      sContainer.innerHTML += `
        <div class="service-card ${item.badge ? 'featured' : ''}">
          ${editBtn}
          ${badgeHtml}
          ${imgHtml}
          <h3>${item.title}</h3>
          <p>${item.desc}</p>
          <div class="service-price"><span class="rose">${item.price}</span></div>
          ${item.time ? `<div class="service-time"><i class="far fa-clock"></i> ${item.time}</div>` : ''}
          <button class="btn-rose small" onclick="selectService('${valForSelect}')">Reservar</button>
        </div>
      `;
    });
  }

  // Render Promos
  const pContainer = document.getElementById('promosGridContainer');
  if (pContainer) {
    pContainer.innerHTML = '';
    promos.forEach(item => {
      const imgPath = item.image;
      const imgHtml = imgPath ? `<img src="${imgPath}" class="promo-image" alt="${item.title}">` : `<div class="promo-icon"><i class="fas ${item.icon}"></i></div>`;
      const badgeClass = item.isHot ? 'promo-badge hot' : 'promo-badge';
      const badgeHtml = item.badge ? `<div class="${badgeClass}">${item.badge}</div>` : '';
      const editBtn = isEditMode ? `
        <button class="edit-overlay-btn" onclick="openEditModal('promo', '${item.id}')"><i class="fas fa-pencil-alt"></i> EDITAR</button>
      ` : '';
      const cardClass = item.isHot ? 'promo-card rose-card' : 'promo-card';
      const valForSelect = `Promo: ${item.title}`;
      pContainer.innerHTML += `
        <div class="${cardClass}">
          ${editBtn}
          ${badgeHtml}
          ${imgHtml}
          <h3>${item.title}</h3>
          <p>${item.desc}</p>
          <div class="promo-price">${item.price}</div>
          <button class="btn-rose small" onclick="selectService('${valForSelect}')">Aprovechar</button>
        </div>
      `;
    });
  }

  // Render Staff
  const staffContainer = document.getElementById('staffGridContainer');
  if (staffContainer) {
    staffContainer.innerHTML = '';
    staffConfig.forEach(item => {
      const imgPath = item.image || 'logo_veros.png';
      const imgHtml = `<img src="${imgPath}" class="service-image" alt="${item.name}" style="height: 280px; object-fit: cover;">`;
      staffContainer.innerHTML += `
        <div class="service-card" style="padding: 0; display: flex; flex-direction: column; height: 100%;">
          ${imgHtml}
          <h3 style="margin-top: 20px; font-family:'Playfair Display', serif; font-size: 22px; font-weight:700; text-align: center;">${item.name}</h3>
          <p style="color:var(--gray); font-size: 14px; margin-bottom: 20px; text-align: center; padding: 0 16px;">${item.role}</p>
          <div style="padding: 0 24px 24px 24px; margin-top: auto; display: flex; gap: 10px; justify-content: center;">
            <button class="btn-rose small full" onclick="openPortfolio('${item.id}', '${item.name}')"><i class="fas fa-images"></i> Trabajos</button>
          </div>
        </div>
      `;
    });
  }

  // Populate Service Select
  const select = document.getElementById('serviceSelect');
  if (select) {
    select.innerHTML = '<option value="">-- Seleccionar --</option>';
    services.forEach(item => {
      const val = `${item.title} (${item.time || 'Promo'})`;
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = `${item.title} - ${item.price}`;
      select.appendChild(opt);
    });
    promos.forEach(item => {
      const val = `Promo: ${item.title}`;
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = `${val} - ${item.price}`;
      select.appendChild(opt);
    });
  }

  populateStaffSelect(staffConfig);
}

// ================= MODAL DE EDICIÓN =================
function openEditModal(type, id) {
  const modal = document.getElementById('editModal');
  if (!modal) return;
  
  window.currentUploadedImage = null;
  
  document.getElementById('editItemType').value = type;
  document.getElementById('editItemId').value = id;
  
  const titleEl = document.getElementById('editModalTitle');
  titleEl.textContent = id === 'new' ? (type === 'service' ? 'Nuevo Servicio' : (type === 'promo' ? 'Nueva Promo' : 'Nueva Manicurista')) : 'Editar Elemento';
  
  const titleGroup = document.getElementById('editTitle').closest('.login-group');
  const descGroup = document.getElementById('editDesc').closest('.login-group');
  const priceGroup = document.getElementById('editPrice').closest('.login-group');
  const timeGroup = document.getElementById('editTime').closest('.login-group');
  const extrasGroup = document.getElementById('editBadge').closest('.login-group');
  
  if (type === 'staff') {
    titleGroup.querySelector('label').innerHTML = 'Nombre';
    descGroup.querySelector('label').innerHTML = 'Especialidad / Cargo';
    priceGroup.querySelector('label').innerHTML = 'Comisión (%)';
    document.getElementById('editPrice').placeholder = 'Ej: 50';
    if (timeGroup) timeGroup.style.display = 'none';
    if (extrasGroup) extrasGroup.style.display = 'none';
  } else {
    titleGroup.querySelector('label').innerHTML = 'Título';
    descGroup.querySelector('label').innerHTML = 'Descripción';
    priceGroup.querySelector('label').innerHTML = 'Precio / Oferta (Texto libre)';
    document.getElementById('editPrice').placeholder = 'Ej: Gs. 50.000 / ¡20% OFF!';
    if (timeGroup) timeGroup.style.display = 'block';
    if (extrasGroup) extrasGroup.style.display = 'flex';
  }

  // Limpiar campos
  document.getElementById('editTitle').value = '';
  document.getElementById('editDesc').value = '';
  document.getElementById('editPrice').value = '';
  document.getElementById('editTime').value = '';
  document.getElementById('editBadge').value = '';
  document.getElementById('editIcon').value = 'fa-star';
  document.getElementById('imagePreviewImg').style.display = 'none';
  document.getElementById('imagePreviewImg').src = '';
  document.getElementById('imagePreviewImg').style.transform = 'scale(1)';
  if(document.getElementById('imageZoom')) document.getElementById('imageZoom').value = '1';
  if(document.getElementById('zoomControl')) document.getElementById('zoomControl').style.display = 'none';
  document.getElementById('imagePreviewPlaceholder').style.display = 'block';
  document.getElementById('editImageInput').value = '';
  
  if (id !== 'new') {
    let item = null;
    if (window.allCatalogItems) {
      item = window.allCatalogItems.find(x => x.id === id);
    }
    if (!item) {
      const list = JSON.parse(localStorage.getItem(type === 'promo' ? 'nails_promos_data' : 'nails_services_data') || '[]');
      item = list.find(x => x.id === id);
    }
    if (item) {
      document.getElementById('editTitle').value = item.title || '';
      document.getElementById('editDesc').value = item.desc || '';
      document.getElementById('editPrice').value = item.price || '';
      document.getElementById('editTime').value = item.time || '';
      document.getElementById('editBadge').value = item.badge || '';
      document.getElementById('editIcon').value = item.icon || 'fa-star';
      
      const imgPath = item.image;
      if (imgPath) {
        document.getElementById('imagePreviewImg').src = imgPath;
        document.getElementById('imagePreviewImg').style.display = 'block';
        document.getElementById('imagePreviewPlaceholder').style.display = 'none';
        if(document.getElementById('zoomControl')) document.getElementById('zoomControl').style.display = 'flex';
        
        // Load image so we can zoom/crop it
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = function() {
          window.currentUploadedImage = img;
        };
        img.src = imgPath;
      }
    }
  }
  
  modal.style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      window.currentUploadedImage = img;
      // Comprimir a max 800px
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800;
      let width = img.width;
      let height = img.height;
      if (width > MAX_WIDTH) {
        height = Math.floor(height * (MAX_WIDTH / width));
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      document.getElementById('imagePreviewImg').src = dataUrl;
      document.getElementById('imagePreviewImg').style.display = 'block';
      document.getElementById('imagePreviewImg').style.transform = 'scale(1)';
      if(document.getElementById('imageZoom')) document.getElementById('imageZoom').value = '1';
      document.getElementById('imagePreviewPlaceholder').style.display = 'none';
      if(document.getElementById('zoomControl')) document.getElementById('zoomControl').style.display = 'flex';
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

// Base64 to Blob
function dataURLtoBlob(dataurl) {
  var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], {type:mime});
}

async function saveEdit() {
  const type = document.getElementById('editItemType').value;
  const id = document.getElementById('editItemId').value;
  const table = type === 'promo' ? 'rosegold_promos' : 'rosegold_services';
  
  const imgSrc = document.getElementById('imagePreviewImg').src;
  const hasImage = document.getElementById('imagePreviewImg').style.display === 'block';
  const isNewImage = hasImage && imgSrc.startsWith('data:image');
  const zoomVal = parseFloat(document.getElementById('imageZoom')?.value || '1');
  const isZoomed = zoomVal !== 1;
  const shouldUpload = isNewImage || (isZoomed && window.currentUploadedImage);
  
  const btn = document.querySelector('#editModal .btn-rose.full');
  const originalBtnText = btn.textContent;
  btn.textContent = 'Guardando...';
  btn.disabled = true;
  
  try {
    let finalImageUrl = hasImage ? imgSrc : null;
    
    // Subir imagen a Supabase si es nueva (Base64) o si fue zoomeada
    if (shouldUpload) {
      let uploadSrc = imgSrc;
      if (window.currentUploadedImage) {
        const img = window.currentUploadedImage;
        
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 500;
        const ctx = canvas.getContext('2d');
        
        const targetAspect = 8 / 5; // 1.6
        const imgAspect = img.width / img.height;
        let cw, ch;
        if (imgAspect > targetAspect) {
          // La imagen es más ancha que 8:5
          ch = img.height / zoomVal;
          cw = ch * targetAspect;
        } else {
          // La imagen es más alta (o igual) que 8:5
          cw = img.width / zoomVal;
          ch = cw / targetAspect;
        }
        const sx = (img.width - cw) / 2;
        const sy = (img.height - ch) / 2;
        
        ctx.drawImage(img, sx, sy, cw, ch, 0, 0, 800, 500);
        uploadSrc = canvas.toDataURL('image/jpeg', 0.85);
      }
      
      const fileName = `img_${Date.now()}.jpg`;
      const fileBlob = dataURLtoBlob(uploadSrc);
      
      const { data: uploadData, error: uploadError } = await supabaseClient
        .storage
        .from('rosegold_images')
        .upload(fileName, fileBlob, { contentType: 'image/jpeg' });
        
      if (uploadError) throw uploadError;
      
      const { data: publicUrlData } = supabaseClient
        .storage
        .from('rosegold_images')
        .getPublicUrl(fileName);
        
      finalImageUrl = publicUrlData.publicUrl;
      
      // Cleanup de imagen vieja (Opcional, requiere conocer la URL anterior)
      if (id !== 'new') {
        let oldItem = null;
        if (window.allCatalogItems) {
          oldItem = window.allCatalogItems.find(x => x.id === id);
        }
        if (!oldItem) {
          const list = JSON.parse(localStorage.getItem(type === 'promo' ? 'nails_promos_data' : 'nails_services_data') || '[]');
          oldItem = list.find(x => x.id === id);
        }
        if (oldItem && oldItem.image) {
           const oldUrl = oldItem.image;
           if (oldUrl.includes('supabase')) {
              const oldFileName = oldUrl.split('/').pop();
              await supabaseClient.storage.from('rosegold_images').remove([oldFileName]);
           }
        }
      }
    } else if (!hasImage && id !== 'new') {
       // Si quitaron la imagen, borrar la vieja
       let oldItem = null;
       if (window.allCatalogItems) {
         oldItem = window.allCatalogItems.find(x => x.id === id);
       }
       if (!oldItem) {
         const list = JSON.parse(localStorage.getItem(type === 'promo' ? 'nails_promos_data' : 'nails_services_data') || '[]');
         oldItem = list.find(x => x.id === id);
       }
       if (oldItem && oldItem.image) {
          const oldUrl = oldItem.image;
          if (oldUrl.includes('supabase')) {
             const oldFileName = oldUrl.split('/').pop();
             await supabaseClient.storage.from('rosegold_images').remove([oldFileName]);
          }
       }
    }

    const itemData = {
      title: document.getElementById('editTitle').value || 'Sin Título',
      desc: document.getElementById('editDesc').value || '',
      price: document.getElementById('editPrice').value || '',
      badge: document.getElementById('editBadge').value || '',
      icon: document.getElementById('editIcon').value || 'fa-star',
      image: finalImageUrl
    };
    
    if (type === 'service') {
      itemData.time = document.getElementById('editTime').value || '';
    } else if (type === 'promo') {
      itemData.isHot = document.getElementById('editBadge').value.toLowerCase().includes('hot');
    } else if (type === 'staff') {
      itemData.icon = 'fa-user-nurse'; // standard icon
    }

    if (id === 'new') {
      itemData.id = generateUUID();
      if (type === 'staff') {
        itemData.badge = 'staff';
      }
      await supabaseClient.from(table).insert([itemData]);
    } else {
      await supabaseClient.from(table).update(itemData).eq('id', id);
    }
    
    closeEditModal();
    await initDynamicCatalog(); // refresh from db
  } catch (err) {
    console.error("Error saving:", err);
    alert("Error al guardar: " + err.message);
  } finally {
    btn.textContent = originalBtnText;
    btn.disabled = false;
  }
}

async function deleteEditItem() {
  const type = document.getElementById('editItemType').value;
  const id = document.getElementById('editItemId').value;
  if (id === 'new') return closeEditModal();
  
  if (confirm('¿Seguro que deseas eliminar este elemento?')) {
    const table = type === 'promo' ? 'rosegold_promos' : 'rosegold_services';
    try {
       // Eliminar foto asociada
       let oldItem = null;
       if (window.allCatalogItems) {
         oldItem = window.allCatalogItems.find(x => x.id === id);
       }
       if (!oldItem) {
         const list = JSON.parse(localStorage.getItem(type === 'promo' ? 'nails_promos_data' : 'nails_services_data') || '[]');
         oldItem = list.find(x => x.id === id);
       }
       if (oldItem && oldItem.image) {
          const oldUrl = oldItem.image;
          if (oldUrl.includes('supabase')) {
             const oldFileName = oldUrl.split('/').pop();
             await supabaseClient.storage.from('rosegold_images').remove([oldFileName]);
          }
       }
       
       await supabaseClient.from(table).delete().eq('id', id);
       closeEditModal();
       await initDynamicCatalog();
    } catch(err) {
       alert("Error al eliminar: " + err.message);
    }
  }
}
// ---- Lógica de Ajustes Globales ----
function getDefaultSettings() {
  return {
    address: 'Av. España casi Gral. Santos, Asunción, Paraguay',
    scheduleShort: 'Lun–Sáb: 09:00 – 19:30\nDom: Cerrado',
    whatsapp: '+595 983 996 807',
    scheduleMap: {
      lunes: '09:00 – 19:30',
      martes: '09:00 – 19:30',
      miercoles: '09:00 – 19:30',
      jueves: '09:00 – 19:30',
      viernes: '09:00 – 19:30',
      sabado: '09:00 – 18:00',
      domingo: 'Cerrado'
    }
  };
}

function applyGlobalSettings(settings) {
  // Update Contact Info
  const addressEl = document.querySelector('.contact-item i.fa-map-marker-alt')?.nextElementSibling?.querySelector('p');
  if (addressEl) addressEl.textContent = settings.address;
  
  const scheduleShortEl = document.querySelector('.contact-item i.fa-clock')?.nextElementSibling?.querySelector('p');
  if (scheduleShortEl) scheduleShortEl.innerHTML = settings.scheduleShort.replace(/\n/g, '<br>');
  
  const waEl = document.querySelector('.contact-item i.fa-whatsapp.rose')?.nextElementSibling?.querySelector('p');
  if (waEl) waEl.textContent = settings.whatsapp;
  
  // Update WA links
  const numOnly = settings.whatsapp.replace(/\D/g, '');
  document.querySelectorAll('a.btn-wa, a.wa-float').forEach(a => {
    const text = a.href.split('text=')[1] || '';
    a.href = `https://wa.me/${numOnly}?text=${text}`;
  });
  
  // Update Hours Table
  const tableRows = document.querySelectorAll('.hours-table tr');
  if (tableRows.length >= 7) {
    const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    days.forEach((day, index) => {
      const cell = tableRows[index].querySelector('td:last-child');
      if (cell) {
        cell.textContent = settings.scheduleMap[day];
        if (settings.scheduleMap[day].toLowerCase().includes('cerrado')) {
          cell.className = 'unavail';
        } else {
          cell.className = 'rose';
        }
      }
    });
  }
}

function openSettingsModal() {
  const set = window.globalSettings || getDefaultSettings();
  document.getElementById('setAddress').value = set.address;
  document.getElementById('setScheduleShort').value = set.scheduleShort;
  document.getElementById('setWhatsapp').value = set.whatsapp;
  
  document.getElementById('setLunes').value = set.scheduleMap.lunes;
  document.getElementById('setMartes').value = set.scheduleMap.martes;
  document.getElementById('setMiercoles').value = set.scheduleMap.miercoles;
  document.getElementById('setJueves').value = set.scheduleMap.jueves;
  document.getElementById('setViernes').value = set.scheduleMap.viernes;
  document.getElementById('setSabado').value = set.scheduleMap.sabado;
  document.getElementById('setDomingo').value = set.scheduleMap.domingo;
  
  document.getElementById('editSettingsModal').style.display = 'flex';
}

function closeSettingsModal() {
  document.getElementById('editSettingsModal').style.display = 'none';
}

async function saveSettings() {
  const setBtn = document.getElementById('saveSettingsBtn');
  setBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  setBtn.disabled = true;
  
  try {
    const newSettings = {
      address: document.getElementById('setAddress').value,
      scheduleShort: document.getElementById('setScheduleShort').value,
      whatsapp: document.getElementById('setWhatsapp').value,
      scheduleMap: {
        lunes: document.getElementById('setLunes').value,
        martes: document.getElementById('setMartes').value,
        miercoles: document.getElementById('setMiercoles').value,
        jueves: document.getElementById('setJueves').value,
        viernes: document.getElementById('setViernes').value,
        sabado: document.getElementById('setSabado').value,
        domingo: document.getElementById('setDomingo').value
      }
    };
    
    // Check if it exists
    const { data } = await supabaseClient.from('rosegold_services').select('id').eq('id', 'settings_global').limit(1);
    
    if (data && data.length > 0) {
      await supabaseClient.from('rosegold_services').update({ title: JSON.stringify(newSettings) }).eq('id', 'settings_global');
    } else {
      await supabaseClient.from('rosegold_services').insert([{
        id: 'settings_global',
        title: JSON.stringify(newSettings),
        desc: 'Configuraciones globales',
        price: '', time: '', badge: '', icon: ''
      }]);
    }
    
    window.globalSettings = newSettings;
    applyGlobalSettings(newSettings);
    closeSettingsModal();
  } catch (err) {
    console.error(err);
    alert("Error al guardar ajustes: " + err.message);
  } finally {
    setBtn.innerHTML = 'Guardar Cambios';
    setBtn.disabled = false;
  }
}

async function deleteItemDirectly(type, id, event) {
  event.stopPropagation(); // Evitar que se abra otro modal o link
  
  if (!confirm("¿Estás seguro de que deseas eliminar este elemento?")) return;
  
  try {
    const table = type === 'promo' ? 'rosegold_promos' : 'rosegold_services';
    
    // Intentar borrar imagen si existe
    let oldItem = null;
    if (window.allCatalogItems) {
      oldItem = window.allCatalogItems.find(x => x.id === id);
    }
    if (!oldItem) {
      const list = JSON.parse(localStorage.getItem(type === 'promo' ? 'nails_promos_data' : 'nails_services_data') || '[]');
      oldItem = list.find(x => x.id === id);
    }
    if (oldItem && oldItem.image && oldItem.image.includes('supabase')) {
       const oldFileName = oldItem.image.split('/').pop();
       await supabaseClient.storage.from('rosegold_images').remove([oldFileName]);
    }
    
    // Borrar registro
    await supabaseClient.from(table).delete().eq('id', id);
    
    // Refrescar
    await initDynamicCatalog();
  } catch (err) {
    console.error("Error delete:", err);
    alert("Error al eliminar: " + err.message);
  }
}

// Attach functions to window if not already
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveSettings = saveSettings;
window.deleteItemDirectly = deleteItemDirectly;

// ---- Lógica de Edición del Banner (Hero) ----
function getDefaultHeroSettings() {
  return [
    { sub: 'Experiencia Spa · Uñas Impecables', titleWhite: 'El Detalle que', titleRose: 'Te Hace Brillar', desc: 'Salón de uñas premium con las últimas tendencias.<br>Estilo, cuidado y sofisticación en tus manos.' },
    { sub: 'Nueva Colección', titleWhite: 'Manos que', titleRose: 'Impactan', desc: 'Descubre nuestras promociones exclusivas en esculpidas y diseños artísticos.' },
    { sub: 'Relajación Total', titleWhite: 'Pedicura', titleRose: 'Spa VIP', desc: 'Sumerge tus pies en un mundo de relajación profunda con nuestra promo especial.' },
    { sub: 'Estilismo y Belleza Capilar', titleWhite: 'Renová tu', titleRose: 'Cabello', desc: 'Peluquería de primer nivel. Tratamientos, color, alisados y cortes con profesionales expertos para resaltar tu belleza.' }
  ];
}

function applyHeroSettings(settings) {
  const slides = document.querySelectorAll('.slider-container .slide');
  if (slides.length !== 4) return; // Fallback
  
  settings.forEach((set, index) => {
    const slide = slides[index];
    const subEl = slide.querySelector('.hero-sub') || slide.querySelector('.hero-tag');
    const titleEl = slide.querySelector('h1');
    const descEl = slide.querySelector('.hero-desc');
    
    if (subEl) subEl.textContent = set.sub;
    if (titleEl) titleEl.innerHTML = `${set.titleWhite}<br><span class="rose">${set.titleRose}</span>`;
    if (descEl) descEl.innerHTML = set.desc;
  });
}

function openHeroModal() {
  const set = window.heroSettings || getDefaultHeroSettings();
  document.getElementById('heroSlideSelect').value = '0';
  document.getElementById('editHeroModal').style.display = 'flex';
  loadHeroForm();
}

function loadHeroForm() {
  const idx = parseInt(document.getElementById('heroSlideSelect').value);
  const set = window.heroSettings || getDefaultHeroSettings();
  const current = set[idx];
  
  document.getElementById('heroSub').value = current.sub;
  document.getElementById('heroTitleWhite').value = current.titleWhite;
  document.getElementById('heroTitleRose').value = current.titleRose;
  document.getElementById('heroDesc').value = current.desc.replace(/<br>/g, '\n');
}

function closeHeroModal() {
  document.getElementById('editHeroModal').style.display = 'none';
}

async function saveHeroSettings() {
  const setBtn = document.getElementById('saveHeroBtn');
  setBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  setBtn.disabled = true;
  
  try {
    const set = window.heroSettings || getDefaultHeroSettings();
    const idx = parseInt(document.getElementById('heroSlideSelect').value);
    
    set[idx].sub = document.getElementById('heroSub').value;
    set[idx].titleWhite = document.getElementById('heroTitleWhite').value;
    set[idx].titleRose = document.getElementById('heroTitleRose').value;
    set[idx].desc = document.getElementById('heroDesc').value.replace(/\n/g, '<br>');
    
    // Check if it exists
    const { data } = await supabaseClient.from('rosegold_services').select('id').eq('id', 'settings_hero').limit(1);
    
    if (data && data.length > 0) {
      await supabaseClient.from('rosegold_services').update({ title: JSON.stringify(set) }).eq('id', 'settings_hero');
    } else {
      await supabaseClient.from('rosegold_services').insert([{
        id: 'settings_hero',
        title: JSON.stringify(set),
        desc: 'Configuraciones de banners',
        price: '', time: '', badge: '', icon: ''
      }]);
    }
    
    window.heroSettings = set;
    applyHeroSettings(set);
    closeHeroModal();
  } catch (err) {
    console.error(err);
    alert("Error al guardar banners: " + err.message);
  } finally {
    setBtn.innerHTML = 'Guardar Cambios';
    setBtn.disabled = false;
  }
}

window.openHeroModal = openHeroModal;
window.closeHeroModal = closeHeroModal;
window.saveHeroSettings = saveHeroSettings;
window.loadHeroForm = loadHeroForm;

// ================= ÁLBUM DE TRABAJOS (PORTFOLIO) =================
function openPortfolio(staffId, staffName) {
  window.currentPortfolioStaffId = staffId;
  const isEditMode = localStorage.getItem('nails_edit_mode') === 'true';
  
  const title = document.getElementById('portfolioModalTitle');
  if (title) title.textContent = `Trabajos de ${staffName}`;
  
  const adminArea = document.getElementById('portfolioAdminArea');
  if (adminArea) adminArea.style.display = isEditMode ? 'block' : 'none';
  
  // Clear inputs
  document.getElementById('workTitle').value = '';
  document.getElementById('workImageInput').value = '';
  document.getElementById('workImagePreviewImg').src = '';
  document.getElementById('workImagePreviewImg').style.display = 'none';
  document.getElementById('workImagePreviewPlaceholder').style.display = 'block';
  window.currentWorkUploadedImage = null;
  
  // Fill service select for work mapping
  const sSelect = document.getElementById('workServiceSelect');
  if (sSelect) {
    sSelect.innerHTML = '<option value="">-- Seleccionar Servicio (Opcional) --</option>';
    const services = window.currentServicesData || [];
    services.forEach(s => {
      const opt = document.createElement('option');
      opt.value = `${s.title} (${s.time || 'Promo'})`;
      opt.textContent = s.title;
      sSelect.appendChild(opt);
    });
  }
  
  renderPortfolioGrid();
  
  document.getElementById('portfolioModal').style.display = 'flex';
}

function closePortfolioModal() {
  document.getElementById('portfolioModal').style.display = 'none';
}

function renderPortfolioGrid() {
  const grid = document.getElementById('portfolioGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const works = (window.currentPortfolioData || []).filter(w => w.badge === window.currentPortfolioStaffId);
  const isEditMode = localStorage.getItem('nails_edit_mode') === 'true';
  
  if (works.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--gray); padding: 40px 0;">Esta manicurista aún no tiene fotos en su álbum.</div>`;
    return;
  }
  
  works.forEach(work => {
    const editBtn = isEditMode ? `
      <button class="edit-overlay-btn" style="background:rgba(239, 68, 68, 0.9); top:10px; right:10px;" onclick="deleteWork('${work.id}', '${work.image}', event)"><i class="fas fa-trash"></i></button>
    ` : '';
    
    // In client mode, click selects staff & service and scrolls to booking form
    const clickAction = !isEditMode ? `onclick="selectWorkBooking('${window.currentPortfolioStaffId}', '${work.price}')"` : '';
    
    grid.innerHTML += `
      <div class="promo-card" style="padding: 0; cursor: ${isEditMode ? 'default' : 'pointer'}; overflow: hidden; position: relative;" ${clickAction}>
        ${editBtn}
        <img src="${work.image}" style="width: 100%; height: 240px; object-fit: cover; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <h4 style="margin: 12px; font-size: 14px; text-align: center; color: white;">${work.title}</h4>
        ${work.price ? `<p style="font-size: 11px; color: var(--rose); margin-bottom: 12px; text-align: center;">${work.price.split(' (')[0]}</p>` : ''}
      </div>
    `;
  });
}

function handleWorkImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      window.currentWorkUploadedImage = img;
      
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800;
      let width = img.width;
      let height = img.height;
      if (width > MAX_WIDTH) {
        height = Math.floor(height * (MAX_WIDTH / width));
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      document.getElementById('workImagePreviewImg').src = dataUrl;
      document.getElementById('workImagePreviewImg').style.display = 'block';
      document.getElementById('workImagePreviewPlaceholder').style.display = 'none';
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveNewWork() {
  if (!window.currentWorkUploadedImage) {
    return alert('Por favor, selecciona una imagen para el trabajo.');
  }
  const title = document.getElementById('workTitle').value.trim() || 'Trabajo realizado';
  const service = document.getElementById('workServiceSelect').value;
  
  const btn = document.getElementById('btnUploadWork');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';
  btn.disabled = true;
  
  try {
    const img = window.currentWorkUploadedImage;
    
    // Crop to 800x500
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    
    const targetAspect = 8 / 5;
    const imgAspect = img.width / img.height;
    let cw, ch;
    if (imgAspect > targetAspect) {
      ch = img.height;
      cw = ch * targetAspect;
    } else {
      cw = img.width;
      ch = cw / targetAspect;
    }
    const sx = (img.width - cw) / 2;
    const sy = (img.height - ch) / 2;
    
    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, 800, 500);
    const uploadSrc = canvas.toDataURL('image/jpeg', 0.85);
    
    const fileName = `work_${Date.now()}.jpg`;
    const fileBlob = dataURLtoBlob(uploadSrc);
    
    const { data: uploadData, error: uploadError } = await supabaseClient
      .storage
      .from('rosegold_images')
      .upload(fileName, fileBlob, { contentType: 'image/jpeg' });
      
    if (uploadError) throw uploadError;
    
    const { data: publicUrlData } = supabaseClient
      .storage
      .from('rosegold_images')
      .getPublicUrl(fileName);
      
    const finalImageUrl = publicUrlData.publicUrl;
    
    // Guardar en rosegold_services (con id prefix work_)
    const workData = {
      id: generateUUID(),
      title: title,
      desc: 'Portfolio Work',
      price: service, // guardar el valor de reserva del servicio
      badge: window.currentPortfolioStaffId, // guardar el id del personal dueño de este álbum
      image: finalImageUrl,
      icon: ''
    };
    
    await supabaseClient.from('rosegold_services').insert([workData]);
    
    // Actualizar datos locales y volver a renderizar
    await initDynamicCatalog();
    renderPortfolioGrid();
    
    // Resetear form de subida
    document.getElementById('workTitle').value = '';
    document.getElementById('workImageInput').value = '';
    document.getElementById('workImagePreviewImg').src = '';
    document.getElementById('workImagePreviewImg').style.display = 'none';
    document.getElementById('workImagePreviewPlaceholder').style.display = 'block';
    window.currentWorkUploadedImage = null;
    
  } catch(e) {
    console.error(e);
    alert('Error al subir trabajo: ' + e.message);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

async function deleteWork(workId, imageUrl, event) {
  if (event) event.stopPropagation();
  if (!confirm('¿Seguro que deseas eliminar esta foto del álbum?')) return;
  
  try {
    // Eliminar de Supabase Storage
    if (imageUrl && imageUrl.includes('supabase')) {
      const fileName = imageUrl.split('/').pop();
      await supabaseClient.storage.from('rosegold_images').remove([fileName]);
    }
    
    // Eliminar de la base de datos
    await supabaseClient.from('rosegold_services').delete().eq('id', workId);
    
    // Refrescar
    await initDynamicCatalog();
    renderPortfolioGrid();
  } catch(e) {
    console.error(e);
    alert('Error al eliminar trabajo: ' + e.message);
  }
}

function selectWorkBooking(staffId, serviceValue) {
  // Buscar el nombre del staff a partir de staffId
  const staffObj = window.allCatalogItems ? window.allCatalogItems.find(x => x.id === staffId) : null;
  if (staffObj) {
    const staffSelect = document.getElementById('staffSelect');
    if (staffSelect) staffSelect.value = staffObj.title;
  }
  
  // Seleccionar el servicio
  if (serviceValue) {
    const serviceSelect = document.getElementById('serviceSelect');
    if (serviceSelect) serviceSelect.value = serviceValue;
  }
  
  closePortfolioModal();
  
  // Scroll suave al formulario de reserva
  const turnosSec = document.getElementById('turnos');
  if (turnosSec) turnosSec.scrollIntoView({ behavior: 'smooth' });
}

window.openPortfolio = openPortfolio;
window.closePortfolioModal = closePortfolioModal;
window.handleWorkImageUpload = handleWorkImageUpload;
window.saveNewWork = saveNewWork;
window.deleteWork = deleteWork;
window.selectWorkBooking = selectWorkBooking;
