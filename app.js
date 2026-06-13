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

// Generar slots del día
function generateSlots(dateStr, closeHour, closeMin = 30) {
  const slots = [];
  
  for (let h = BUSINESS_HOURS.open; h <= closeHour; h++) {
    for (let m = 0; m < 60; m += SLOT_INTERVAL) {
      if (h === closeHour && m > closeMin) break;
      const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      slots.push(timeStr);
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
  if (dayOfWeek === 0) {
    select.innerHTML = '<option value="">❌ Domingo - Cerrado</option>';
    return;
  }
  const closeHour = dayOfWeek === 6 ? 18 : 19;
  const closeMin = dayOfWeek === 6 ? 0 : 30;
  const slots = generateSlots(dateStr, closeHour, closeMin);
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

  if (dayOfWeek === 0) {
    grid.innerHTML = '<p style="color:#ef4444;font-size:14px;grid-column:1/-1;text-align:center;">El salón está cerrado los domingos 🚫</p>';
    return;
  }
  
  const closeHour = dayOfWeek === 6 ? 18 : 19;
  const closeMin = dayOfWeek === 6 ? 0 : 30;
  const slots = generateSlots(dateStr, closeHour, closeMin);
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

  // Poblar staff dinámicamente
  let storedConfig = localStorage.getItem('nails_staff_config');
  let staffConfig = [];
  if (!storedConfig) {
    staffConfig.push({ id: Date.now().toString(), name: 'Valeria', role: 'Especialista Acrílico', commission: 50 });
    staffConfig.push({ id: (Date.now()+1).toString(), name: 'Sofía', role: 'Especialista Pedicura', commission: 40 });
    localStorage.setItem('nails_staff_config', JSON.stringify(staffConfig));
  } else {
    staffConfig = JSON.parse(storedConfig);
  }
  
  const staffGroup = document.getElementById('staffGroup');
  const staffSelect = document.getElementById('staffSelect');
  
  if (staffConfig.length === 0) {
    if (staffGroup) staffGroup.style.display = 'none';
  } else {
    if (staffGroup) staffGroup.style.display = 'block';
    if (staffSelect) {
      staffConfig.forEach(staff => {
        const opt = document.createElement('option');
        opt.value = staff.name;
        opt.textContent = `${staff.name} (${staff.role})`;
        staffSelect.appendChild(opt);
      });
    }
  }

  // Cargar Catálogo Dinámico (Servicios y Promos)
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

function initDynamicCatalog() {
  if (!document.getElementById('servicesGridContainer')) return; // Solo en index.html
  
  if (!localStorage.getItem('nails_services_data')) {
    localStorage.setItem('nails_services_data', JSON.stringify(DEFAULT_SERVICES));
  }
  if (!localStorage.getItem('nails_promos_data')) {
    localStorage.setItem('nails_promos_data', JSON.stringify(DEFAULT_PROMOS));
  }
  
  renderDynamicCatalog();
}

function renderDynamicCatalog() {
  const isEditMode = localStorage.getItem('nails_edit_mode') === 'true';
  const services = JSON.parse(localStorage.getItem('nails_services_data') || '[]');
  const promos = JSON.parse(localStorage.getItem('nails_promos_data') || '[]');
  
  // Render Services
  const sContainer = document.getElementById('servicesGridContainer');
  if (sContainer) {
    sContainer.innerHTML = '';
    services.forEach(item => {
      const imgHtml = item.image ? `<img src="${item.image}" class="service-image" alt="${item.title}">` : `<div class="service-icon"><i class="fas ${item.icon}"></i></div>`;
      const badgeHtml = item.badge ? `<div class="badge">${item.badge}</div>` : '';
      const editBtn = isEditMode ? `<button class="edit-overlay-btn" onclick="openEditModal('service', '${item.id}')"><i class="fas fa-pencil-alt"></i> EDITAR</button>` : '';
      
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
      const imgHtml = item.image ? `<img src="${item.image}" class="promo-image" alt="${item.title}">` : `<div class="promo-icon"><i class="fas ${item.icon}"></i></div>`;
      const badgeClass = item.isHot ? 'promo-badge hot' : 'promo-badge';
      const badgeHtml = item.badge ? `<div class="${badgeClass}">${item.badge}</div>` : '';
      const editBtn = isEditMode ? `<button class="edit-overlay-btn" onclick="openEditModal('promo', '${item.id}')"><i class="fas fa-pencil-alt"></i> EDITAR</button>` : '';
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
}

// ================= MODAL DE EDICIÓN =================
function openEditModal(type, id) {
  const modal = document.getElementById('editModal');
  if (!modal) return;
  
  document.getElementById('editItemType').value = type;
  document.getElementById('editItemId').value = id;
  
  const titleEl = document.getElementById('editModalTitle');
  titleEl.textContent = id === 'new' ? (type === 'service' ? 'Nuevo Servicio' : 'Nueva Promo') : 'Editar Elemento';
  
  // Limpiar campos
  document.getElementById('editTitle').value = '';
  document.getElementById('editDesc').value = '';
  document.getElementById('editPrice').value = '';
  document.getElementById('editTime').value = '';
  document.getElementById('editBadge').value = '';
  document.getElementById('editIcon').value = 'fa-star';
  document.getElementById('imagePreviewImg').style.display = 'none';
  document.getElementById('imagePreviewImg').src = '';
  document.getElementById('imagePreviewPlaceholder').style.display = 'block';
  document.getElementById('editImageInput').value = '';
  
  if (id !== 'new') {
    const list = JSON.parse(localStorage.getItem(`nails_${type}s_data`) || '[]');
    const item = list.find(x => x.id === id);
    if (item) {
      document.getElementById('editTitle').value = item.title || '';
      document.getElementById('editDesc').value = item.desc || '';
      document.getElementById('editPrice').value = item.price || '';
      document.getElementById('editTime').value = item.time || '';
      document.getElementById('editBadge').value = item.badge || '';
      document.getElementById('editIcon').value = item.icon || 'fa-star';
      
      if (item.image) {
        document.getElementById('imagePreviewImg').src = item.image;
        document.getElementById('imagePreviewImg').style.display = 'block';
        document.getElementById('imagePreviewPlaceholder').style.display = 'none';
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
      // Comprimir a max 600px
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 600;
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
      document.getElementById('imagePreviewPlaceholder').style.display = 'none';
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function saveEdit() {
  const type = document.getElementById('editItemType').value;
  const id = document.getElementById('editItemId').value;
  const key = `nails_${type}s_data`;
  let list = JSON.parse(localStorage.getItem(key) || '[]');
  
  const imgSrc = document.getElementById('imagePreviewImg').src;
  const hasImage = document.getElementById('imagePreviewImg').style.display === 'block';
  
  const itemData = {
    title: document.getElementById('editTitle').value || 'Sin Título',
    desc: document.getElementById('editDesc').value || '',
    price: document.getElementById('editPrice').value || '',
    time: document.getElementById('editTime').value || '',
    badge: document.getElementById('editBadge').value || '',
    icon: document.getElementById('editIcon').value || 'fa-star',
    image: hasImage ? imgSrc : null,
    isHot: document.getElementById('editBadge').value.toLowerCase().includes('hot') // heurística simple
  };
  
  if (id === 'new') {
    itemData.id = Date.now().toString();
    list.push(itemData);
  } else {
    const idx = list.findIndex(x => x.id === id);
    if (idx !== -1) {
      itemData.id = id;
      list[idx] = itemData;
    }
  }
  
  localStorage.setItem(key, JSON.stringify(list));
  closeEditModal();
  renderDynamicCatalog();
}

function deleteEditItem() {
  const type = document.getElementById('editItemType').value;
  const id = document.getElementById('editItemId').value;
  if (id === 'new') return closeEditModal();
  
  if (confirm('¿Seguro que deseas eliminar este elemento?')) {
    const key = `nails_${type}s_data`;
    let list = JSON.parse(localStorage.getItem(key) || '[]');
    list = list.filter(x => x.id !== id);
    localStorage.setItem(key, JSON.stringify(list));
    closeEditModal();
    renderDynamicCatalog();
  }
}
