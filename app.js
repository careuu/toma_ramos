// Toma de Ramos Scheduling App Core Logic

// State Management
const state = {
  courses: [],
  selectedSections: {}, // { courseCode: sectionObject }
  selectedAssistants: {}, // { assistantId: assistantOption }
  hoveredSection: null, // { courseCode, section }
  hoveredAssistant: null, // assistantOption
  currentStep: 1, // 1: Toma de Ramos, 2: Postulación de Ayudantías de Lab, 3: Postulación de Ayudantías de Ciencias Básicas
  expandedSemesters: {}, // All semesters collapsed by default
  selectedSemester: 'all', // Default to showing all semesters on initial page load
  isSemestersExpanded: false, // Semesters accordion state
  filters: {
    clash: false,
    selected: false,
    query: ''
  },
  assistantFilter: 'all'
};

// CSS Variables for Calendar Rendering
const startHour = 8; // 08:00
const endHour = 23;  // 23:00
const hourHeight = 60; // 60px per hour (1px = 1 minute)
const calendarStartMinutes = startHour * 60; // 480 minutes

// Curated Pastel Colors from User Palette (Solid) - LIGHT MODE
const COURSE_COLORS = [
  '#C5E0DC',   // #C5E0DC (Soft Sage / Teal)
  '#ECE5CE',   // #ECE5CE (Pale Cream / Warm White)
  '#F1D4AF',   // #F1D4AF (Soft Peach / Apricot)
  '#E08E79',   // #E08E79 (Terracotta / Coral)
  '#CFB7B9',   // #CFB7B9 (Dusty Rose / Mauve)
  '#A79C8E'    // #A79C8E (Warm Taupe / Muted Grey)
];

// Pastel Colors for DARK MODE - more vivid/saturated to pop on dark backgrounds
const COURSE_COLORS_DARK = [
  '#4DB8B0',   // Vivid Teal
  '#D4A843',   // Warm Amber / Gold
  '#E07B5A',   // Deep Coral / Terracotta
  '#8B7FD4',   // Soft Indigo / Lavender
  '#5BAD8F',   // Sage Green
  '#C97AB2'    // Mauve / Orchid
];

// Utility: Hash course code to select a stable color
function getCourseColor(courseCode) {
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) {
    hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % COURSE_COLORS.length;
  const isDark = document.body.classList.contains('dark-mode');
  return isDark ? COURSE_COLORS_DARK[idx] : COURSE_COLORS[idx];
}

// Utility: Convert HH:MM time to minutes relative to 00:00
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.trim().split(':').map(Number);
  return h * 60 + m;
}

// Utility: Check if two time intervals overlap
function timeRangesOverlap(start1, end1, start2, end2) {
  return timeToMinutes(start1) < timeToMinutes(end2) && timeToMinutes(start2) < timeToMinutes(end1);
}

// Utility: Check if two sections clash
function sectionsClash(sec1, sec2) {
  for (const e1 of sec1.events) {
    for (const t1 of e1.times) {
      for (const e2 of sec2.events) {
        for (const t2 of e2.times) {
          if (t1.day === t2.day && timeRangesOverlap(t1.start, t1.end, t2.start, t2.end)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// Get vertical positioning values (top and height in pixels)
function getEventPosition(startStr, endStr) {
  const startMin = timeToMinutes(startStr) - calendarStartMinutes;
  const endMin = timeToMinutes(endStr) - calendarStartMinutes;
  const top = (startMin / 60) * hourHeight;
  const height = ((endMin - startMin) / 60) * hourHeight;
  return { top, height };
}

// Load selected schedule from local storage
function loadSavedSchedule() {
  try {
    const saved = localStorage.getItem('toma_ramos_schedule');
    if (saved) {
      state.selectedSections = JSON.parse(saved);
    }
    const savedAssistants = localStorage.getItem('toma_ramos_assistants');
    if (savedAssistants) {
      state.selectedAssistants = JSON.parse(savedAssistants);
    }
    const savedStep = localStorage.getItem('toma_ramos_step');
    if (savedStep) {
      state.currentStep = parseInt(savedStep, 10) || 1;
    }
  } catch (e) {
    console.error('Error loading saved schedule:', e);
  }
}

// Save current schedule to local storage
function saveSchedule() {
  try {
    localStorage.setItem('toma_ramos_schedule', JSON.stringify(state.selectedSections));
    localStorage.setItem('toma_ramos_assistants', JSON.stringify(state.selectedAssistants));
    localStorage.setItem('toma_ramos_step', state.currentStep.toString());
  } catch (e) {
    console.error('Error saving schedule:', e);
  }
}

// Render Time Axis & Horizontal Grid Lines
function initCalendarBg() {
  const timeAxis = document.getElementById('time-axis');
  const gridLinesContainer = document.getElementById('time-grid-lines');
  
  timeAxis.innerHTML = '';
  gridLinesContainer.innerHTML = '';
  
  const totalHours = endHour - startHour;
  
  for (let i = 0; i <= totalHours; i++) {
    const currentHour = startHour + i;
    const hourLabel = `${String(currentHour).padStart(2, '0')}:00`;
    const offsetTop = i * hourHeight;
    
    // Add hourly tick to time axis column
    const tick = document.createElement('div');
    tick.className = 'time-tick';
    tick.style.top = `${offsetTop}px`;
    tick.innerText = hourLabel;
    timeAxis.appendChild(tick);
    
    // Add grid line background
    const line = document.createElement('div');
    line.className = 'grid-line';
    line.style.top = `${offsetTop}px`;
    gridLinesContainer.appendChild(line);
    
    // Half-hour dashed line (only if not the last line)
    if (i < totalHours) {
      const halfLine = document.createElement('div');
      halfLine.className = 'grid-line half-hour';
      halfLine.style.top = `${offsetTop + (hourHeight / 2)}px`;
      gridLinesContainer.appendChild(halfLine);
    }
  }
}

// Utility: Check if dark mode is active
function isDarkMode() {
  return document.body.classList.contains('dark-mode');
}

// Render Calendar Event Blocks
function renderCalendar() {
  // Clear day columns
  const dayColumns = document.querySelectorAll('.day-column');
  dayColumns.forEach(col => col.innerHTML = '');

  // Gather selected and preview events
  const eventsToRender = [];

  // Add selected events
  for (const [courseCode, section] of Object.entries(state.selectedSections)) {
    const course = state.courses.find(c => c.code === courseCode);
    if (!course) continue;
    const color = getCourseColor(courseCode);
    section.events.forEach(event => {
      event.times.forEach(time => {
        eventsToRender.push({
          courseCode,
          courseName: course.name,
          sectionName: section.section,
          professor: section.professor,
          type: event.type,
          day: time.day,
          start: time.start,
          end: time.end,
          color,
          isPreview: false
        });
      });
    });
  }

  // Add hover preview events (if not already selected)
  if (state.hoveredSection && !state.selectedSections[state.hoveredSection.courseCode]) {
    const { courseCode, section } = state.hoveredSection;
    const course = state.courses.find(c => c.code === courseCode);
    if (course) {
      const color = getCourseColor(courseCode);
      section.events.forEach(event => {
        event.times.forEach(time => {
          eventsToRender.push({
            courseCode,
            courseName: course.name,
            sectionName: section.section,
            professor: section.professor,
            type: event.type,
            day: time.day,
            start: time.start,
            end: time.end,
            color,
            isPreview: true
          });
        });
      });
    }
  }

  // Add selected assistantships
  Object.values(state.selectedAssistants).forEach(opt => {
    opt.event.times.forEach(time => {
      eventsToRender.push({
        courseCode: opt.courseCode,
        courseName: opt.courseName,
        sectionName: opt.sectionName,
        professor: opt.professor,
        type: opt.event.type,
        day: time.day,
        start: time.start,
        end: time.end,
        color: isDarkMode()
          ? (opt.assistantType === 'cb' ? '#1e2f3d' : '#2d2440')
          : (opt.assistantType === 'cb' ? '#D4E9F7' : '#E2D9F3'),
        isPreview: false,
        isAssistant: true,
        assistantId: opt.id,
        assistantType: opt.assistantType || 'lab'
      });
    });
  });

  // Add hover preview assistant (if not already selected)
  if (state.hoveredAssistant && !state.selectedAssistants[state.hoveredAssistant.id]) {
    const opt = state.hoveredAssistant;
    opt.event.times.forEach(time => {
      eventsToRender.push({
        courseCode: opt.courseCode,
        courseName: opt.courseName,
        sectionName: opt.sectionName,
        professor: opt.professor,
        type: opt.event.type,
        day: time.day,
        start: time.start,
        end: time.end,
        color: opt.assistantType === 'cb' ? '#5499C7' : '#b57aff',
        isPreview: true,
        isAssistantPreview: true,
        assistantId: opt.id,
        assistantType: opt.assistantType || 'lab'
      });
    });
  }

  // Group events by day
  const eventsByDay = { LU: [], MA: [], MI: [], JU: [], VI: [], SA: [] };
  eventsToRender.forEach(ev => {
    if (eventsByDay[ev.day]) {
      eventsByDay[ev.day].push(ev);
    }
  });

  // Render events per day column with side-by-side positioning for overlaps
  for (const [day, dayEvents] of Object.entries(eventsByDay)) {
    const colElement = document.querySelector(`.day-column[data-day="${day}"]`);
    if (!colElement) continue;

    // 1. Sort by start time
    dayEvents.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

    // 2. Build overlap clusters (connected events that touch in time)
    const groups = [];
    dayEvents.forEach(event => {
      let added = false;
      for (const group of groups) {
        // If event overlaps with ANY event in this group, add it to this cluster
        const overlaps = group.some(ge => {
          return timeRangesOverlap(event.start, event.end, ge.start, ge.end);
        });
        if (overlaps) {
          group.push(event);
          added = true;
          break;
        }
      }
      if (!added) {
        groups.push([event]);
      }
    });

    // 3. Allocate sub-columns to items within each cluster
    groups.forEach(group => {
      const columns = []; // Array of sub-column contents
      group.forEach(event => {
        let placed = false;
        for (let colIdx = 0; colIdx < columns.length; colIdx++) {
          const overlaps = columns[colIdx].some(ce => {
            return timeRangesOverlap(event.start, event.end, ce.start, ce.end);
          });
          if (!overlaps) {
            columns[colIdx].push(event);
            event.layoutCol = colIdx;
            placed = true;
            break;
          }
        }
        if (!placed) {
          columns.push([event]);
          event.layoutCol = columns.length - 1;
        }
      });

      // Assign column count to events for percentage widths
      const totalCols = columns.length;
      group.forEach(event => {
        event.layoutTotalCols = totalCols;
      });
    });

    // 4. Create and inject DOM elements
    dayEvents.forEach(event => {
      const pos = getEventPosition(event.start, event.end);
      const div = document.createElement('div');
      
      div.className = 'event-block';
      if (event.isPreview) div.classList.add('preview');
      if (event.isAssistant) {
        div.classList.add('assistant');
        if (event.assistantType === 'cb') {
          div.classList.add('assistant-cb');
        } else {
          div.classList.add('assistant-lab');
        }
      }
      if (event.isAssistantPreview) {
        div.classList.add('assistant-preview');
        if (event.assistantType === 'cb') {
          div.classList.add('assistant-cb');
        } else {
          div.classList.add('assistant-lab');
        }
      }
      
      const colWidth = 100 / event.layoutTotalCols;
      const leftOffset = colWidth * event.layoutCol;
      
      div.style.top = `${pos.top}px`;
      div.style.height = `${pos.height}px`;
      div.style.left = `calc(${leftOffset}% + 2px)`;
      div.style.width = `calc(${colWidth}% - 4px)`;
      
      if (event.isPreview) {
        if (event.isAssistantPreview) {
          const previewBg = event.assistantType === 'cb' ? 'rgba(84, 153, 199, 0.15)' : 'rgba(181, 122, 255, 0.15)';
          div.style.setProperty('--preview-bg-color', previewBg);
          div.style.setProperty('--preview-border-color', event.color);
          div.style.setProperty('--preview-text-color', isDarkMode() ? '#f0ece8' : '#1f1916');
        } else {
          const r = parseInt(event.color.slice(1, 3), 16);
          const g = parseInt(event.color.slice(3, 5), 16);
          const b = parseInt(event.color.slice(5, 7), 16);
          const previewBg = `rgba(${r}, ${g}, ${b}, 0.25)`;
          
          div.style.setProperty('--preview-bg-color', previewBg);
          div.style.setProperty('--preview-border-color', event.color);
          div.style.setProperty('--preview-text-color', isDarkMode() ? '#f0ece8' : '#1f1916');
        }
      } else {
        const textColor = isDarkMode() ? '#f0ece8' : '#110e0c';
        const borderColor = isDarkMode() ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)';
        if (event.isAssistant) {
          div.style.backgroundColor = event.color;
          div.style.color = textColor;
          div.style.borderLeft = `4px solid ${event.assistantType === 'cb' ? '#5499C7' : '#b57aff'}`;
        } else {
          div.style.backgroundColor = event.color;
          div.style.color = textColor;
          div.style.borderLeft = `4px solid ${borderColor}`;
        }
      }

      // Check if this event clashes with another SELECTED event on the same day
      const hasClash = dayEvents.some(other => {
        if (other.courseCode === event.courseCode) return false;
        if (other.isPreview || event.isPreview) return false;
        return timeRangesOverlap(event.start, event.end, other.start, other.end);
      });

      if (hasClash) {
        div.classList.add('has-clash');
        const badge = document.createElement('div');
        badge.className = 'clash-badge';
        badge.innerText = '!';
        div.appendChild(badge);
      }

      // Content Injection
      const title = document.createElement('div');
      title.className = 'event-block-title';
      let prefix = '';
      if (event.isAssistant) {
        prefix = event.assistantType === 'cb' ? '[AYUD CB] ' : '[AYUD LAB] ';
      }
      title.innerText = prefix + event.courseName;
      div.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'event-block-meta';
      
      const typeSpan = document.createElement('span');
      typeSpan.className = 'event-block-type';
      // Abbreviate type
      let typeAbbr = event.type;
      if (event.isAssistant) typeAbbr = event.assistantType === 'cb' ? 'AYUD (CB)' : 'LAB (Ayud)';
      else if (typeAbbr.includes('AYUD')) typeAbbr = 'AYUD';
      else if (typeAbbr.includes('CÁTE')) typeAbbr = 'CÁTE';
      else if (typeAbbr.includes('LABO')) typeAbbr = 'LAB';
      
      // Extract section number from "Sección 1" -> "1"
      const secNum = event.sectionName.replace(/\D/g, '');
      typeSpan.innerText = `${typeAbbr} • Sec ${secNum}`;
      meta.appendChild(typeSpan);

      const timeSpan = document.createElement('span');
      timeSpan.innerText = `${event.start} - ${event.end}`;
      meta.appendChild(timeSpan);

      const profSpan = document.createElement('span');
      profSpan.className = 'event-block-prof';
      profSpan.innerText = event.professor ? event.professor : 'Prof. Por designar';
      meta.appendChild(profSpan);

      div.appendChild(meta);

      // Accordion click-focus / Modal opening behavior
      div.onclick = () => {
        if (event.isAssistant) {
          const card = document.querySelector(`.assistant-card[data-id="${event.assistantId}"]`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        } else {
          showCourseDetailModal(event.courseCode);
        }
      };

      colElement.appendChild(div);
    });
  }
}

// Compute Statistics (Credits, Course Count, Conflicts)
function updateStats() {
  const selectedKeys = Object.keys(state.selectedSections);
  const count = selectedKeys.length;
  let credits = 0;
  let conflicts = 0;

  selectedKeys.forEach(code => {
    const course = state.courses.find(c => c.code === code);
    if (course) {
      credits += course.credits;
    }
  });

  // Count clashing pairs
  for (let i = 0; i < count; i++) {
    const sec1 = state.selectedSections[selectedKeys[i]];
    for (let j = i + 1; j < count; j++) {
      const sec2 = state.selectedSections[selectedKeys[j]];
      if (sectionsClash(sec1, sec2)) {
        conflicts++;
      }
    }
  }

  // Update DOM elements
  document.getElementById('stats-courses').innerText = count;
  document.getElementById('stats-credits').innerText = credits;
  
  const conflictBadge = document.getElementById('conflict-badge-container');
  if (conflicts > 0) {
    document.getElementById('stats-conflicts').innerText = conflicts;
    conflictBadge.style.display = 'flex';
  } else {
    conflictBadge.style.display = 'none';
  }
}

// Toggle Course Card Accordion
function toggleCourseCard(cardElement) {
  const isActive = cardElement.classList.contains('active');
  
  // Collapse all other active courses (optional, but makes navigation cleaner)
  document.querySelectorAll('.course-card.active').forEach(card => {
    if (card !== cardElement) {
      card.classList.remove('active');
    }
  });
  
  cardElement.classList.toggle('active', !isActive);
}

// Select or Deselect Section
function selectSection(courseCode, sectionObj) {
  const currentSelected = state.selectedSections[courseCode];
  
  if (currentSelected && currentSelected.section === sectionObj.section) {
    // Already selected, deselect it
    delete state.selectedSections[courseCode];
  } else {
    // Select this section (replaces any previous section selected for this course)
    state.selectedSections[courseCode] = sectionObj;
  }
  
  saveSchedule();
  updateStats();
  renderCalendar();
  renderCourseList();
}

// Toggle Semester accordion state
function toggleSemester(semIdx) {
  state.expandedSemesters[semIdx] = !state.expandedSemesters[semIdx];
  renderCourseList();
}

// Generate the HTML for the Course Cards and Sections List, grouped by Semester
function renderCourseList() {
  const container = document.getElementById('course-list');
  const noResults = document.getElementById('no-results');
  
  if (state.currentStep === 2) {
    renderAssistantshipList(container, noResults);
    return;
  }
  
  const filtered = state.courses.filter(course => {
    // Search query check (accent-insensitive)
    const query = state.filters.query.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normalizedName = course.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const matchesSearch = course.code.toLowerCase().includes(query) || normalizedName.includes(query);
    if (!matchesSearch) return false;
    
    // Filter by selected
    if (state.filters.selected && !state.selectedSections[course.code]) {
      return false;
    }
    
    // Filter by clash (only hide if it clashes with something selected and is NOT selected itself)
    if (state.filters.clash) {
      const isSelected = !!state.selectedSections[course.code];
      if (!isSelected) {
        // If all sections of this course clash with already selected items, hide the course
        const allSectionsClash = course.sections.every(sec => {
          return Object.values(state.selectedSections).some(selSec => sectionsClash(sec, selSec));
        });
        if (allSectionsClash) return false;
      }
    }
    
    return true;
  });

  // Handle empty state
  if (filtered.length === 0) {
    container.style.display = 'none';
    noResults.style.display = 'flex';
    return;
  }
  
  noResults.style.display = 'none';
  container.style.display = 'flex';
  
  // Save active course card to restore state
  const activeCode = document.querySelector('.course-card.active')?.dataset.code;

  container.innerHTML = '';
  
  // Group courses by semester (1 to 11)
  const coursesBySemester = {};
  for (let i = 1; i <= 11; i++) {
    coursesBySemester[i] = [];
  }
  
  filtered.forEach(course => {
    const sem = course.semester || 9; // Fallback to 9
    coursesBySemester[sem].push(course);
  });
  
  const isSearchActive = state.filters.query.trim().length > 0;
  
  if (!isSearchActive) {
    // 1. Render Semesters Accordion Selector
    const selectorGroup = document.createElement('div');
    selectorGroup.className = 'semesters-selector-group';
    if (state.isSemestersExpanded) {
      selectorGroup.classList.add('expanded');
    }

    const selectorHeader = document.createElement('div');
    selectorHeader.className = 'semesters-selector-header';
    selectorHeader.onclick = () => {
      state.isSemestersExpanded = !state.isSemestersExpanded;
      renderCourseList();
    };

    const headerTitleArea = document.createElement('div');
    headerTitleArea.className = 'semesters-selector-title-area';

    const layersIcon = document.createElement('span');
    layersIcon.className = 'material-symbols-outlined semesters-icon';
    layersIcon.innerText = 'layers';
    headerTitleArea.appendChild(layersIcon);

    const titleText = document.createElement('span');
    titleText.className = 'semesters-selector-title-text';
    titleText.innerText = 'Semestres';
    headerTitleArea.appendChild(titleText);

    selectorHeader.appendChild(headerTitleArea);

    const headerRightArea = document.createElement('div');
    headerRightArea.className = 'semesters-selector-right-area';

    const activeBadge = document.createElement('span');
    activeBadge.className = 'semesters-selector-current-badge';
    if (state.selectedSemester === 'all') {
      activeBadge.innerText = 'Todos';
    } else {
      activeBadge.innerText = state.selectedSemester === 11 ? 'Titulamiento' : `Semestre ${state.selectedSemester}`;
    }
    headerRightArea.appendChild(activeBadge);

    const arrowIcon = document.createElement('span');
    arrowIcon.className = 'material-symbols-outlined semesters-arrow';
    arrowIcon.innerText = 'expand_more';
    headerRightArea.appendChild(arrowIcon);

    selectorHeader.appendChild(headerRightArea);
    selectorGroup.appendChild(selectorHeader);

    // If expanded, render options grid
    if (state.isSemestersExpanded) {
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'semesters-selector-options';

      // Option "Todos los semestres"
      const todosOption = document.createElement('div');
      todosOption.className = 'semester-option';
      todosOption.style.gridColumn = 'span 2';
      if (state.selectedSemester === 'all') {
        todosOption.classList.add('selected');
      }

      const todosLabel = document.createElement('span');
      todosLabel.innerText = 'Todos los ramos';
      todosOption.appendChild(todosLabel);

      const todosBadge = document.createElement('span');
      todosBadge.className = 'semester-option-count-badge';
      todosBadge.innerText = filtered.length;
      todosOption.appendChild(todosBadge);

      todosOption.onclick = (e) => {
        e.stopPropagation();
        state.selectedSemester = 'all';
        state.isSemestersExpanded = false;
        renderCourseList();
      };
      optionsContainer.appendChild(todosOption);

      for (let semIdx = 1; semIdx <= 11; semIdx++) {
        // Count courses of this semester matching active filters
        const count = coursesBySemester[semIdx].length;

        const option = document.createElement('div');
        option.className = 'semester-option';
        if (semIdx === state.selectedSemester) {
          option.classList.add('selected');
        }

        const optionLabel = document.createElement('span');
        optionLabel.innerText = semIdx === 11 ? 'Titulamiento' : `Semestre ${semIdx}`;
        option.appendChild(optionLabel);

        const optionBadge = document.createElement('span');
        optionBadge.className = 'semester-option-count-badge';
        optionBadge.innerText = count;
        option.appendChild(optionBadge);

        option.onclick = (e) => {
          e.stopPropagation();
          state.selectedSemester = semIdx;
          state.isSemestersExpanded = false;
          renderCourseList();
        };

        optionsContainer.appendChild(option);
      }
      selectorGroup.appendChild(optionsContainer);
    }

    container.appendChild(selectorGroup);

    // 2. Render Active Semester Title Divider
    const activeTitle = document.createElement('div');
    activeTitle.className = 'active-semester-title';
    if (state.selectedSemester === 'all') {
      activeTitle.innerHTML = '<h3>Todos los Ramos</h3>';
    } else {
      activeTitle.innerHTML = `<h3>Ramos de ${state.selectedSemester === 11 ? 'Titulamiento / Examen' : 'Semestre ' + state.selectedSemester}</h3>`;
    }
    container.appendChild(activeTitle);

    // 3. Gather courses to render (flat list, ordered by semester)
    let coursesToRender = [];
    if (state.selectedSemester === 'all') {
      for (let i = 1; i <= 11; i++) {
        coursesToRender.push(...coursesBySemester[i]);
      }
    } else {
      coursesToRender = coursesBySemester[state.selectedSemester] || [];
    }

    renderCoursesFlat(coursesToRender, container, activeCode);
  } else {
    // 4. Render Active Semester Title Divider for Search
    const activeTitle = document.createElement('div');
    activeTitle.className = 'active-semester-title';
    activeTitle.innerHTML = '<h3>Resultados de Búsqueda</h3>';
    container.appendChild(activeTitle);

    // 5. Gather all search matching courses sorted by semester
    const coursesToRender = [];
    for (let i = 1; i <= 11; i++) {
      coursesToRender.push(...coursesBySemester[i]);
    }

    renderCoursesFlat(coursesToRender, container, activeCode);
  }
}

// Helper to render courses flatly in the list
function renderCoursesFlat(courses, container, activeCode) {
  if (courses.length === 0) {
    const noCoursesDiv = document.createElement('div');
    noCoursesDiv.className = 'no-results-inner';
    noCoursesDiv.style.padding = '2rem 1rem';
    noCoursesDiv.style.textAlign = 'center';
    noCoursesDiv.style.color = 'var(--text-muted)';
    noCoursesDiv.innerHTML = `
      <span class="material-symbols-outlined" style="font-size: 2.5rem; margin-bottom: 0.5rem;">search_off</span>
      <p style="font-size: 0.85rem;">No hay ramos seleccionables para los filtros actuales.</p>
    `;
    container.appendChild(noCoursesDiv);
    return;
  }

  const coursesContainer = document.createElement('div');
  coursesContainer.className = 'semester-courses';
  coursesContainer.style.display = 'flex'; // Ensure displayed

  courses.forEach(course => {
    const isSelected = !!state.selectedSections[course.code];
    const selectedSec = state.selectedSections[course.code];

    const card = document.createElement('div');
    card.className = 'course-card';
    card.dataset.code = course.code;
    if (isSelected) card.classList.add('has-selected');
    if (course.code === activeCode) card.classList.add('active');

    // Course Header
    const header = document.createElement('div');
    header.className = 'course-header';
    header.onclick = () => toggleCourseCard(card);

    const leftInfo = document.createElement('div');
    leftInfo.className = 'course-header-left';

    const codeSpan = document.createElement('span');
    codeSpan.className = 'course-code';
    codeSpan.innerText = course.code;

    if (isSelected) {
      const dot = document.createElement('span');
      dot.className = 'material-symbols-outlined';
      dot.style.fontSize = '0.8rem';
      dot.style.color = 'var(--primary)';
      dot.innerText = 'check_circle';
      codeSpan.appendChild(dot);
    }
    leftInfo.appendChild(codeSpan);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'course-title';
    titleSpan.innerText = course.name;
    leftInfo.appendChild(titleSpan);

    const rightInfo = document.createElement('div');
    rightInfo.className = 'course-header-right';

    // Show a semester badge if we are displaying all semesters or search is active
    const isSearchActive = state.filters.query.trim().length > 0;
    if (state.selectedSemester === 'all' || isSearchActive) {
      const semBadge = document.createElement('span');
      semBadge.className = 'course-semester-tag';
      semBadge.innerText = course.semester === 11 ? 'Titulamiento' : `Sem ${course.semester}`;
      rightInfo.appendChild(semBadge);
    }

    const creditsSpan = document.createElement('span');
    creditsSpan.className = 'course-credits';
    creditsSpan.innerText = `${course.credits} Cr`;
    rightInfo.appendChild(creditsSpan);

    const arrow = document.createElement('span');
    arrow.className = 'material-symbols-outlined toggle-arrow';
    arrow.innerText = 'expand_more';
    rightInfo.appendChild(arrow);

    header.appendChild(leftInfo);
    header.appendChild(rightInfo);
    card.appendChild(header);

    // Course Sections Accordion Panel
    const sectionsContainer = document.createElement('div');
    sectionsContainer.className = 'course-sections';

    course.sections.forEach(sec => {
      const isSecSelected = selectedSec && selectedSec.section === sec.section;

      const clashesWithOthers = Object.entries(state.selectedSections).some(([selCode, selSec]) => {
        if (selCode === course.code) return false;
        return sectionsClash(sec, selSec);
      });

      const secCard = document.createElement('div');
      secCard.className = 'section-card';
      if (isSecSelected) secCard.classList.add('selected');
      if (clashesWithOthers) secCard.classList.add('clashing');

      const topRow = document.createElement('div');
      topRow.className = 'section-top-row';

      const secName = document.createElement('span');
      secName.className = 'section-name';
      secName.innerText = sec.section;
      topRow.appendChild(secName);

      const checkMarker = document.createElement('div');
      checkMarker.className = 'section-check';
      const checkIcon = document.createElement('span');
      checkIcon.className = 'material-symbols-outlined';
      checkIcon.innerText = 'check';
      checkMarker.appendChild(checkIcon);
      topRow.appendChild(checkMarker);

      secCard.appendChild(topRow);

      const prof = document.createElement('div');
      prof.className = 'section-professor';
      prof.innerText = sec.professor || 'Profesor Por Designar';
      secCard.appendChild(prof);

      const metaRow = document.createElement('div');
      metaRow.className = 'section-meta-row';

      const vacItem = document.createElement('div');
      vacItem.className = 'section-meta-item';
      const vacIcon = document.createElement('span');
      vacIcon.className = 'material-symbols-outlined';
      vacIcon.innerText = 'group';
      vacItem.appendChild(vacIcon);
      vacItem.appendChild(document.createTextNode(` Vac: ${sec.vacancies}`));
      metaRow.appendChild(vacItem);

      if (sec.package) {
        const pkgItem = document.createElement('div');
        pkgItem.className = 'section-meta-item';
        const pkgIcon = document.createElement('span');
        pkgIcon.className = 'material-symbols-outlined';
        pkgIcon.innerText = 'inventory_2';
        pkgItem.appendChild(pkgIcon);

        let pkgName = sec.package;
        if (pkgName.length > 15) pkgName = pkgName.substring(0, 12) + '...';
        pkgItem.appendChild(document.createTextNode(` Pq: ${pkgName}`));
        pkgItem.title = `Paquete: ${sec.package}`;
        metaRow.appendChild(pkgItem);
      }

      secCard.appendChild(metaRow);

      const schedDiv = document.createElement('div');
      schedDiv.className = 'section-schedules';
      sec.events.forEach(ev => {
        const row = document.createElement('div');
        row.className = 'schedule-row';

        const typeBadge = document.createElement('span');
        typeBadge.className = 'schedule-type';
        typeBadge.innerText = ev.type.includes('AYUD') ? 'Ayud' : (ev.type.includes('CÁTE') ? 'Cát' : 'Lab');
        row.appendChild(typeBadge);

        const timeSpan = document.createElement('span');
        timeSpan.className = 'schedule-time';
        timeSpan.innerText = ev.schedule_raw;
        row.appendChild(timeSpan);

        schedDiv.appendChild(row);
      });
      secCard.appendChild(schedDiv);

      secCard.onclick = (e) => {
        e.stopPropagation();
        selectSection(course.code, sec);
      };

      secCard.onmouseenter = () => {
        state.hoveredSection = { courseCode: course.code, section: sec };
        renderCalendar();
      };

      secCard.onmouseleave = () => {
        state.hoveredSection = null;
        renderCalendar();
      };

      sectionsContainer.appendChild(secCard);
    });

    card.appendChild(sectionsContainer);
    coursesContainer.appendChild(card);
  });

  container.appendChild(coursesContainer);
}

// Print/PDF Handler
function setupExport() {
  document.getElementById('btn-export').addEventListener('click', () => {
    // Inform user of print method (opens window print configured via CSS print styles)
    window.print();
  });
}

// Clear Schedule Action
function setupClearAll() {
  const clearModal = document.getElementById('confirm-clear-modal');

  document.getElementById('btn-clear').addEventListener('click', () => {
    if (Object.keys(state.selectedSections).length === 0 && Object.keys(state.selectedAssistants).length === 0) return;
    clearModal.style.display = 'flex';
    clearModal.classList.add('active');
  });

  document.getElementById('btn-confirm-clear-cancel').addEventListener('click', () => {
    clearModal.classList.remove('active');
    setTimeout(() => { clearModal.style.display = 'none'; }, 200);
  });

  document.getElementById('btn-confirm-clear-ok').addEventListener('click', () => {
    clearModal.classList.remove('active');
    setTimeout(() => { clearModal.style.display = 'none'; }, 200);
    state.selectedSections = {};
    state.selectedAssistants = {};
    saveSchedule();
    updateStats();
    renderCalendar();
    renderCourseList();
  });

  // Close when clicking outside the card
  clearModal.addEventListener('click', (e) => {
    if (e.target === clearModal) {
      clearModal.classList.remove('active');
      setTimeout(() => { clearModal.style.display = 'none'; }, 200);
    }
  });
}

// Search Inputs listener
function setupSearchAndFilters() {
  const searchInput = document.getElementById('search-input');
  const clearSearch = document.getElementById('clear-search');
  
  // Input search text
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    state.filters.query = val;
    clearSearch.style.display = val.length > 0 ? 'block' : 'none';
    renderCourseList();
  });
  
  // Clear search button
  clearSearch.addEventListener('click', () => {
    searchInput.value = '';
    state.filters.query = '';
    clearSearch.style.display = 'none';
    renderCourseList();
    searchInput.focus();
  });
  
  // Clash filter
  document.getElementById('filter-clash').addEventListener('change', (e) => {
    state.filters.clash = e.target.checked;
    renderCourseList();
  });
  
  // Selected filter
  document.getElementById('filter-selected').addEventListener('change', (e) => {
    state.filters.selected = e.target.checked;
    renderCourseList();
  });
}

// Highlight current day column header (LU-SA)
function highlightCurrentDay() {
  const days = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'];
  const todayIndex = new Date().getDay();
  const todayCode = days[todayIndex];
  
  if (todayCode && todayCode !== 'DO') {
    const header = document.querySelector(`.day-header-cell[data-day="${todayCode}"]`);
    if (header) header.classList.add('active-day');
  }
}

// Print Styles injection to hide sidebar during print/export
function injectPrintStyles() {
  const style = document.createElement('style');
  style.innerHTML = `
    @media print {
      body {
        background: #ffffff !important;
        color: #000000 !important;
      }
      .app-container {
        display: block !important;
        height: auto !important;
        width: auto !important;
      }
      .sidebar {
        display: none !important;
      }
      .main-content {
        padding: 0 !important;
        height: auto !important;
        width: 100% !important;
        overflow: visible !important;
      }
      .main-header {
        margin-bottom: 2rem !important;
      }
      .header-actions {
        display: none !important;
      }
      .calendar-wrapper-card {
        border: none !important;
        box-shadow: none !important;
        background: transparent !important;
        overflow: visible !important;
        height: auto !important;
      }
      .calendar-container {
        height: auto !important;
        overflow: visible !important;
      }
      .calendar-days-header {
        background: #f3f4f6 !important;
        border: 1px solid #d1d5db !important;
      }
      .day-header-cell, .time-header-cell {
        color: #1f2937 !important;
        border-color: #d1d5db !important;
      }
      .calendar-body {
        height: 1000px !important;
        overflow: visible !important;
      }
      .time-axis {
        background: #f9fafb !important;
        border-color: #d1d5db !important;
      }
      .time-tick {
        color: #4b5563 !important;
      }
      .grid-line {
        border-color: #e5e7eb !important;
      }
      .event-block {
        border: 1px solid rgba(0, 0, 0, 0.15) !important;
        box-shadow: none !important;
        color: #000000 !important;
      }
      .event-block-title {
        color: #000000 !important;
      }
      .event-block-meta {
        color: #374151 !important;
      }
      .event-block-type {
        color: #111827 !important;
      }
      .clash-badge {
        background: #ef4444 !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// Application Initialization
function init() {
  // Check if data is loaded correctly
  if (typeof COURSES_DATA === 'undefined') {
    document.getElementById('loading-indicator').innerHTML = `
      <span class="material-symbols-outlined error" style="font-size: 3rem; color: var(--accent-rose);">error</span>
      <p style="color: var(--text-primary); font-weight: bold; margin-top: 0.5rem;">Error de carga de datos</p>
      <p style="font-size: 0.8rem; text-align: center; max-width: 250px;">El archivo 'courses_data.js' no está presente o está corrupto.</p>
    `;
    return;
  }

  state.courses = COURSES_DATA.filter(course => {
    const normalizedName = course.name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return !normalizedName.includes("PRACTICA");
  });
  document.getElementById('loading-indicator').style.display = 'none';

  loadSavedSchedule();
  initCalendarBg();
  updateStats();
  renderCalendar();
  renderCourseList();
  highlightCurrentDay();
  
  setupSearchAndFilters();
  setupClearAll();
  setupExport();
  injectPrintStyles();
  setupStepNavigation();
  setupModalEvents();
}

// Wizard Step Navigation Setup
function setupStepNavigation() {
  document.getElementById('btn-next-step').addEventListener('click', () => {
    if (state.currentStep === 1) {
      setStep(2);
    }
  });
  document.getElementById('btn-prev-step').addEventListener('click', () => {
    if (state.currentStep === 2) {
      setStep(1);
    }
  });
  
  // Initialize to the persisted step
  setStep(state.currentStep || 1);
}

// Switch between Step 1 (Ramos) and Step 2 (Ayudantías)
function setStep(step) {
  if (step > 2) step = 2;
  state.currentStep = step;
  
  // If moving to step 2, validate and prune any selected assistantships that now clash
  // (in case the user went back to step 1, changed courses, and then proceeded again)
  if (step === 2) {
    Object.keys(state.selectedAssistants).forEach(id => {
      const opt = state.selectedAssistants[id];
      if (isAssistantClashing(opt)) {
        delete state.selectedAssistants[id];
      }
    });
  }
  
  const searchSection = document.querySelector('.search-section');
  const statsPanel = document.querySelector('.stats-panel');
  const mainHeaderTitle = document.querySelector('.main-header h2');
  const btnNext = document.getElementById('btn-next-step');
  const btnPrev = document.getElementById('btn-prev-step');
  const campusDisplay = document.getElementById('campus-display');
  
  if (step === 1) {
    searchSection.style.display = 'flex';
    statsPanel.style.display = 'grid';
    mainHeaderTitle.innerText = 'Horario Seleccionado';
    campusDisplay.innerText = 'Sede: S-SANTIAGO';
    btnNext.style.display = 'flex';
    btnNext.innerHTML = `
      <span>Siguiente: Ayudantías</span>
      <span class="material-symbols-outlined">arrow_forward</span>
    `;
    btnPrev.style.display = 'none';
  } else if (step === 2) {
    searchSection.style.display = 'none';
    statsPanel.style.display = 'none';
    mainHeaderTitle.innerText = 'Postulación a Ayudantías';
    campusDisplay.innerText = 'Laboratorios de Física y Ayudantías de Ciencias Básicas';
    btnNext.style.display = 'none';
    btnPrev.style.display = 'flex';
    btnPrev.innerHTML = `
      <span class="material-symbols-outlined">arrow_back</span>
      <span>Atrás: Editar Ramos</span>
    `;
  }
  
  renderCourseList();
  renderCalendar();
  saveSchedule();
}

// Extract Physics lab options from state.courses (CBF1100, CBF1001, CBF1002)
function getPhysicsLabOptions() {
  const physicsCodes = ['CBF1100', 'CBF1001', 'CBF1002'];
  const options = [];
  
  state.courses.forEach(course => {
    if (physicsCodes.includes(course.code)) {
      course.sections.forEach(sec => {
        sec.events.forEach(ev => {
          if (ev.type.toUpperCase().includes('LAB')) {
            options.push({
              id: `${course.code}_${sec.section}_${ev.type}`,
              courseCode: course.code,
              courseName: course.name,
              sectionName: sec.section,
              professor: sec.professor,
              event: ev,
              assistantType: 'lab'
            });
          }
        });
      });
    }
  });
  
  return options;
}

// Extract Basic Sciences assistant options from state.courses
function getBasicSciencesAssistantOptions() {
  const basicSciencesCodes = ['CBM1100', 'CBM1101', 'CBM1102', 'CBM1103', 'CBM1005', 'CBM1006'];
  const options = [];
  
  state.courses.forEach(course => {
    if (basicSciencesCodes.includes(course.code)) {
      course.sections.forEach(sec => {
        sec.events.forEach(ev => {
          if (ev.type.toUpperCase().includes('AYUD')) {
            options.push({
              id: `${course.code}_${sec.section}_${ev.type}`,
              courseCode: course.code,
              courseName: course.name,
              sectionName: sec.section,
              professor: sec.professor,
              event: ev,
              assistantType: 'cb'
            });
          }
        });
      });
    }
  });
  
  return options;
}

// Check if an assistant option clashes with cátedra events in the selected schedule.
// Overlapping with ayudantías is ALLOWED (you can be assistant during your own ayudantía hours).
// Only cátedras (lectures) are a hard restriction.
function isAssistantClashing(opt) {
  // 1. Cannot be assistant for a course currently selected/taken in Step 1
  if (state.selectedSections[opt.courseCode]) {
    return true;
  }
  
  // 2. Schedule clash check: only block if overlapping with a CÁTEDRA event
  return Object.entries(state.selectedSections).some(([courseCode, selSec]) => {
    return selSec.events.some(selEv => {
      // Allow overlap with ayudantías — only block cátedras
      const isCatedra = selEv.type.toUpperCase().includes('CÁTE') || selEv.type.toUpperCase().includes('CATE');
      if (!isCatedra) return false;

      return selEv.times.some(t1 => {
        return opt.event.times.some(t2 => {
          if (t1.day !== t2.day) return false;
          return timeRangesOverlap(t1.start, t1.end, t2.start, t2.end);
        });
      });
    });
  });
}

// Toggle Assistantship Selection
function toggleAssistant(opt) {
  if (state.selectedAssistants[opt.id]) {
    delete state.selectedAssistants[opt.id];
  } else {
    state.selectedAssistants[opt.id] = opt;
  }
  renderCourseList();
  renderCalendar();
  saveSchedule();
}

// Render the Assistantships list inside the sidebar (both Lab and Basic Sciences)
function renderAssistantshipList(container, noResults) {
  noResults.style.display = 'none';
  container.style.display = 'flex';
  container.innerHTML = '';
  
  const physicsOptions = getPhysicsLabOptions();
  const basicScienceOptions = getBasicSciencesAssistantOptions();
  
  // Dynamic Selector / Filters
  const filterDiv = document.createElement('div');
  filterDiv.className = 'assistant-filters';
  
  const filterConfig = [
    { id: 'all', label: 'Todas', count: physicsOptions.length + basicScienceOptions.length },
    { id: 'lab', label: 'Laboratorios (Física)', count: physicsOptions.length },
    { id: 'cb', label: 'Ciencias Básicas', count: basicScienceOptions.length }
  ];
  
  filterConfig.forEach(f => {
    const btn = document.createElement('button');
    btn.className = `filter-pill ${state.assistantFilter === f.id ? 'active' : ''}`;
    btn.innerHTML = `<span>${f.label}</span><span class="pill-count">${f.count}</span>`;
    btn.onclick = () => {
      state.assistantFilter = f.id;
      renderCourseList();
    };
    filterDiv.appendChild(btn);
  });
  
  container.appendChild(filterDiv);
  
  let displayedOptions = [];
  if (state.assistantFilter === 'all') {
    displayedOptions = [...physicsOptions, ...basicScienceOptions];
  } else if (state.assistantFilter === 'lab') {
    displayedOptions = physicsOptions;
  } else if (state.assistantFilter === 'cb') {
    displayedOptions = basicScienceOptions;
  }
  
  if (displayedOptions.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'no-results-inner';
    emptyDiv.style.padding = '2rem 1rem';
    emptyDiv.style.textAlign = 'center';
    emptyDiv.style.color = 'var(--text-muted)';
    emptyDiv.innerHTML = `
      <span class="material-symbols-outlined" style="font-size: 2.5rem; margin-bottom: 0.5rem;">search_off</span>
      <p style="font-size: 0.85rem;">No hay ayudantías en esta categoría</p>
    `;
    container.appendChild(emptyDiv);
    return;
  }
  
  // Group by Course Code/Name
  const grouped = {};
  displayedOptions.forEach(opt => {
    if (!grouped[opt.courseCode]) {
      grouped[opt.courseCode] = {
        code: opt.courseCode,
        name: opt.courseName,
        assistantType: opt.assistantType,
        items: []
      };
    }
    grouped[opt.courseCode].items.push(opt);
  });
  
  Object.values(grouped).forEach(group => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'semester-group expanded';
    
    const header = document.createElement('div');
    header.className = 'semester-header';
    header.style.cursor = 'default';
    header.onclick = null;
    
    const titleArea = document.createElement('div');
    titleArea.className = 'semester-header-title';
    
    const titleText = document.createElement('span');
    titleText.innerText = `${group.code} - ${group.name}`;
    titleArea.appendChild(titleText);
    
    const badge = document.createElement('span');
    badge.className = 'semester-badge';
    
    const isCb = group.assistantType === 'cb';
    badge.style.background = isCb ? '#5499C7' : '#b57aff';
    badge.innerText = `${group.items.length} ${group.items.length === 1 ? 'bloque' : 'bloques'}`;
    titleArea.appendChild(badge);
    
    header.appendChild(titleArea);
    groupDiv.appendChild(header);
    
    const listContainer = document.createElement('div');
    listContainer.className = 'semester-courses';
    listContainer.style.display = 'flex';
    
    group.items.forEach(opt => {
      const isSelected = !!state.selectedAssistants[opt.id];
      const clashing = isAssistantClashing(opt);
      
      const card = document.createElement('div');
      card.className = `assistant-card ${isCb ? 'assistant-cb' : 'assistant-lab'}`;
      card.dataset.id = opt.id;
      if (isSelected) card.classList.add('selected');
      if (clashing) {
        card.classList.add('disabled');
      }
      
      const cardHeader = document.createElement('div');
      cardHeader.className = 'assistant-card-header';
      
      const secName = document.createElement('span');
      secName.className = 'assistant-section';
      secName.innerText = opt.sectionName;
      cardHeader.appendChild(secName);
      
      if (clashing) {
        const clashBadge = document.createElement('span');
        clashBadge.className = 'assistant-clash-badge';
        if (state.selectedSections[opt.courseCode]) {
          clashBadge.innerText = 'Inscrito';
          clashBadge.title = 'Estás cursando esta asignatura este semestre';
        } else {
          clashBadge.innerText = 'Tope';
          clashBadge.title = 'Topa con una cátedra de tu horario';
        }
        cardHeader.appendChild(clashBadge);
      } else {
        const checkbox = document.createElement('div');
        checkbox.className = 'assistant-checkbox';
        const checkIcon = document.createElement('span');
        checkIcon.className = 'material-symbols-outlined';
        checkIcon.innerText = 'check';
        checkbox.appendChild(checkIcon);
        cardHeader.appendChild(checkbox);
      }
      
      card.appendChild(cardHeader);
      
      // Professor
      const prof = document.createElement('div');
      prof.className = 'assistant-prof';
      prof.innerText = opt.professor ? `Prof: ${opt.professor}` : 'Prof. Por designar';
      card.appendChild(prof);
      
      // Schedule Row
      const sched = document.createElement('div');
      sched.className = 'assistant-schedule';
      
      const clockIcon = document.createElement('span');
      clockIcon.className = 'material-symbols-outlined';
      clockIcon.style.fontSize = '0.9rem';
      clockIcon.innerText = 'schedule';
      sched.appendChild(clockIcon);
      
      const timeSpan = document.createElement('span');
      timeSpan.innerText = `${opt.event.type} (${opt.event.schedule_raw})`;
      sched.appendChild(timeSpan);
      
      card.appendChild(sched);
      
      // Interactions
      if (!clashing) {
        card.onclick = () => {
          toggleAssistant(opt);
        };
        
        card.onmouseenter = () => {
          state.hoveredAssistant = opt;
          renderCalendar();
        };
        
        card.onmouseleave = () => {
          state.hoveredAssistant = null;
          renderCalendar();
        };
      }
      
      listContainer.appendChild(card);
    });
    
    groupDiv.appendChild(listContainer);
    container.appendChild(groupDiv);
  });
}

// Generate an academic description for a course based on its name and code
function getCourseDescription(courseCode, courseName) {
  const name = courseName.toUpperCase();
  
  if (name.includes("CÁLCULO") || name.includes("CALCULO") || name.includes("INTRODUCCIÓN AL CÁLCULO")) {
    return "Esta asignatura fundamental de la línea de matemáticas proporciona las herramientas de análisis conceptual y operativo del cálculo infinitesimal. Cubre el estudio de límites, derivadas, integrales y sus aplicaciones en la optimización de sistemas y modelamiento de fenómenos físicos y económicos, esenciales para la formación del pensamiento cuantitativo en ingeniería.";
  }
  if (name.includes("ÁLGEBRA") || name.includes("ALGEBRA")) {
    return "Esta asignatura de la línea de ciencias básicas introduce los conceptos de estructuras algebraicas, sistemas de ecuaciones lineales, matrices, determinantes, espacios vectoriales y transformaciones lineales. Permite formalizar problemas complejos y proporciona el sustento teórico e instrumental para el modelamiento matemático multidimensional y la programación lineal.";
  }
  if (name.includes("ECUACIONES DIFERENCIALES")) {
    return "Asignatura avanzada de matemáticas orientada al modelamiento dinámico de sistemas en ingeniería. Estudia ecuaciones diferenciales ordinarias de primer orden y de orden superior, transformadas de Laplace y sistemas de ecuaciones diferenciales, permitiendo analizar y predecir el comportamiento temporal de procesos físicos, térmicos, mecánicos y financieros.";
  }
  if (name.includes("FÍSICA") || name.includes("FISICA") || name.includes("MECÁNICA") || name.includes("CALOR") || name.includes("ELECTRICIDAD")) {
    return "Asignatura del área de ciencias naturales orientada a comprender y aplicar las leyes fundamentales de la naturaleza en la resolución de problemas de ingeniería. Cubre mecánica clásica, termodinámica u electromagnetismo, desarrollando el rigor científico, la experimentación en laboratorios y el análisis cuantitativo de fuerzas, energías y campos.";
  }
  if (name.includes("PROBABILIDADES") || name.includes("ESTADÍSTICA") || name.includes("ESTADISTICA")) {
    return "Esta asignatura introduce los modelos probabilísticos y técnicas de inferencia estadística para la toma de decisiones bajo incertidumbre. Abarca estadística descriptiva, variables aleatorias, distribuciones muestrales, pruebas de hipótesis y regresión lineal, capacitando en el análisis de datos de procesos productivos y de servicios.";
  }
  if (name.includes("QUÍMICA") || name.includes("QUIMICA")) {
    return "Asignatura introductoria a la estructura de la materia, reacciones químicas y estequiometría. Cubre principios de termoquímica, equilibrio químico, cinética y electroquímica, entregando herramientas para comprender procesos a nivel molecular y su aplicación en tecnologías limpias, materiales y control ambiental.";
  }
  if (name.includes("PRÁCTICA") || name.includes("PRACTICA")) {
    return "Actividad curricular de inmersión profesional donde el estudiante aplica sus competencias técnicas y de gestión en un entorno laboral real, resolviendo problemas específicos de la organización y desarrollando habilidades de comunicación, trabajo en equipo y ética profesional.";
  }
  
  return `Asignatura perteneciente al plan de estudios de Ingeniería Civil Industrial de la Universidad Diego Portales. Tiene como objetivo desarrollar competencias analíticas, técnicas y de gestión en los estudiantes, preparándolos para afrontar desafíos profesionales mediante el diseño, optimización y dirección de sistemas complejos de producción y servicios.`;
}

// Display the Course Detail Modal
function showCourseDetailModal(courseCode) {
  const course = state.courses.find(c => c.code === courseCode);
  if (!course) return;

  const selectedSec = state.selectedSections[courseCode];
  
  // Set basic details
  document.getElementById('modal-course-code').innerText = course.code;
  document.getElementById('modal-course-name').innerText = course.name;
  document.getElementById('modal-course-credits').innerText = `${course.credits} Cr`;
  document.getElementById('modal-course-semester').innerText = course.semester === 11 ? 'Titulamiento / Examen' : `Semestre ${course.semester}`;
  document.getElementById('modal-course-description').innerText = getCourseDescription(course.code, course.name);
  
  // Set selected section info
  const selectedInfoContainer = document.getElementById('modal-selected-section-info');
  if (selectedSec) {
    let schedulesHtml = selectedSec.events.map(ev => {
      return `<div style="font-size: 0.75rem; margin-top: 0.15rem;"><strong>${ev.type}:</strong> ${ev.schedule_raw}</div>`;
    }).join('');
    
    selectedInfoContainer.innerHTML = `
      <div class="modal-selected-box">
        <div class="modal-selected-top">
          <span class="modal-selected-sec">${selectedSec.section}</span>
          <span class="modal-selected-prof">${selectedSec.professor || 'Profesor Por Designar'}</span>
        </div>
        <div class="modal-selected-meta">
          <span><strong>Cupos:</strong> ${selectedSec.vacancies}</span>
          ${selectedSec.package ? `<span><strong>Paquete:</strong> ${selectedSec.package}</span>` : ''}
        </div>
        <div style="margin-top: 0.25rem; border-top: 1px dashed rgba(224, 142, 121, 0.2); padding-top: 0.4rem;">
          ${schedulesHtml}
        </div>
      </div>
    `;
  } else {
    selectedInfoContainer.innerHTML = `<p style="font-style: italic; color: var(--text-muted);">Ninguna sección seleccionada.</p>`;
  }
  
  // Set other sections available
  const otherSectionsContainer = document.getElementById('modal-other-sections-list');
  const otherSections = course.sections.filter(sec => !selectedSec || sec.section !== selectedSec.section);
  
  if (otherSections.length > 0) {
    otherSectionsContainer.innerHTML = otherSections.map(sec => {
      let schedulesHtml = sec.events.map(ev => {
        return `<span class="schedule-type" style="margin-right: 0.25rem; font-size: 0.55rem; padding: 0.05rem 0.2rem;">${ev.type.includes('AYUD') ? 'Ayud' : (ev.type.includes('CÁTE') ? 'Cát' : 'Lab')}</span> <span style="font-size: 0.7rem; color: var(--text-secondary);">${ev.schedule_raw}</span>`;
      }).join('<br>');
      
      return `
        <div class="modal-section-row">
          <div class="modal-section-row-info">
            <span class="modal-section-row-name">${sec.section}</span>
            <span class="modal-section-row-prof">${sec.professor || 'Profesor Por Designar'}</span>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem;">Cupos: ${sec.vacancies}</div>
            <div>${schedulesHtml}</div>
          </div>
        </div>
      `;
    }).join('');
  } else {
    otherSectionsContainer.innerHTML = `<p style="font-style: italic; color: var(--text-muted); font-size: 0.85rem;">No hay otras secciones disponibles.</p>`;
  }
  
  // Open modal
  const modal = document.getElementById('course-detail-modal');
  modal.classList.add('active');
  modal.style.display = 'flex';
}

// Close the Course Detail Modal
function closeCourseDetailModal() {
  const modal = document.getElementById('course-detail-modal');
  modal.classList.remove('active');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 200);
}

// Set up modal events for closing
function setupModalEvents() {
  document.getElementById('btn-close-modal').addEventListener('click', closeCourseDetailModal);
  
  // Close when clicking outside the card
  document.getElementById('course-detail-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      closeCourseDetailModal();
    }
  });
}

// ===== DARK MODE LOGIC =====
function initDarkMode() {
  const btn = document.getElementById('btn-dark-mode-toggle');
  const icon = document.getElementById('dark-mode-icon');
  const savedTheme = localStorage.getItem('toma_ramos_theme');

  function applyDark() {
    document.body.classList.add('dark-mode');
    icon.textContent = 'light_mode';
    btn.title = 'Cambiar a modo claro';
  }

  function applyLight() {
    document.body.classList.remove('dark-mode');
    icon.textContent = 'dark_mode';
    btn.title = 'Cambiar a modo oscuro';
  }

  // Restore saved preference or use system preference
  if (savedTheme === 'dark') {
    applyDark();
  } else if (savedTheme === 'light') {
    applyLight();
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyDark();
  }

  btn.addEventListener('click', () => {
    if (document.body.classList.contains('dark-mode')) {
      applyLight();
      localStorage.setItem('toma_ramos_theme', 'light');
    } else {
      applyDark();
      localStorage.setItem('toma_ramos_theme', 'dark');
    }
    // Re-render calendar so course colors update instantly
    if (typeof renderCalendar === 'function') renderCalendar();
  });
}

// Start app on DOM load
window.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  init();
});
