import xml.etree.ElementTree as ET
import json
import re

def parse_schedule_time(schedule_str):
    """
    Parses a schedule string like 'LU JU 08:30 - 09:50' or 'MI 11:30 - 12:50'
    Returns a list of dicts: [{'day': 'LU', 'start': '08:30', 'end': '09:50'}, ...]
    """
    if not schedule_str or not isinstance(schedule_str, str):
        return []
    
    # Match pattern: DAYS HH:MM - HH:MM
    match = re.match(r'^([A-Z\s]+)\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})', schedule_str.strip())
    if not match:
        return []
    
    days_part, start, end = match.groups()
    days = [d.strip() for d in days_part.split() if d.strip()]
    
    parsed = []
    for day in days:
        parsed.append({
            'day': day,
            'start': start,
            'end': end
        })
    return parsed

def get_semester(code, name):
    """
    Returns the semester index (1 to 11) for a given course code and name
    based on the INGENIERIA_CIVIL_INDUSTRIAL_UDP.pdf curriculum.
    """
    code = code.upper().strip()
    name = name.upper().strip()
    
    # Semester 1
    if code in ['CBM1100', 'CBM1101', 'CBQ1100', 'CIT1100', 'FIC1100']:
        return 1
    if 'COMUNICACIÓN PARA LA INGENIERÍA' in name or 'COMUNICACION' in name:
        return 1
        
    # Semester 2
    if code in ['CBM1102', 'CBM1103', 'CBF1100', 'EII1200']:
        return 2
    if 'INGLÉS GENERAL I' in name or 'INGLES GENERAL I' in name or code == 'CIG1001':
        return 2
        
    # Semester 3
    if code in ['CBM1005', 'CBM1006', 'CBF1001', 'CII1000']:
        return 3
    if 'INGLÉS GENERAL II' in name or 'INGLES GENERAL II' in name or code == 'CIG1002':
        return 3
        
    # Semester 4
    if code in ['CBE2000', 'CII2250', 'CBF1002', 'CII2100']:
        return 4
    if 'INGLÉS GENERAL III' in name or 'INGLES GENERAL III' in name or code in ['CIG1003', 'CIG1014']:
        return 4
        
    # Semester 5
    if code in ['CII2751', 'CII2401', 'CII2750', 'CII1001']:
        return 5
    if 'PRÁCTICA PROFESIONAL I' in name or 'PRACTICA PROFESIONAL I' in name or code in ['ICI5001', 'ICI5011', 'ICI5011']:
        return 5
        
    # Semester 6
    if code in ['CII2501', 'CII2402', 'CII2755', 'CII2101', 'CII2002']:
        return 6
        
    # Semester 7
    if code in ['CII2756', 'CII2403', 'CII2253', 'CII2102', 'CII2003']:
        return 7
        
    # Semester 8
    if code in ['CII2504', 'CII2757', 'CII2254', 'CII2103', 'CII2004']:
        return 8
    if 'PRÁCTICA PROFESIONAL II' in name or 'PRACTICA PROFESIONAL II' in name or code in ['ICI5002', 'ICI5022']:
        return 8
        
    # Semester 9
    if code in ['CII3101', 'CII3503', 'CII3600', 'CII3603', 'CII3607']:
        return 9
        
    # Semester 10
    if code == 'CII3102':
        return 10
        
    # Semester 11
    if 'TESIS' in name or 'TITULO' in name or code in ['ICI3388', 'ICI3333', 'ICIMAG', 'ICI3309']:
        return 11
        
    # Fallbacks based on code prefixes
    if code.startswith('CII37') or code.startswith('CII38'):
        # Electivos profesionales (usually Semesters 9 and 10)
        return 10
    if code.startswith('CII3'):
        return 9
    if 'INGLÉS' in name or 'INGLES' in name:
        return 4
    if 'PRÁCTICA' in name or 'PRACTICA' in name:
        return 8
        
    return 9

def main():
    file_path = "ING_CIVIL_INDUSTRIAL.xls"
    
    # Read as bytes and decode as UTF-8
    with open(file_path, 'rb') as f:
        content_bytes = f.read()
    content_str = content_bytes.decode('utf-8')
    
    # Parse XML from string
    root = ET.fromstring(content_str)
    
    ns = '{urn:schemas-microsoft-com:office:spreadsheet}'
    
    # Find the table
    table = root.find(f'.//{ns}Table')
    if table is None:
        print("Table not found in XML!")
        return
        
    rows = table.findall(f'{ns}Row')
    print(f"Total rows found: {len(rows)}")
    
    courses = {}
    
    for row_idx, row in enumerate(rows):
        if row_idx == 0:
            continue # Skip header
            
        cells = row.findall(f'{ns}Cell')
        if not cells:
            continue
            
        # Check if the first cell has data
        first_cell_data = cells[0].find(f'{ns}Data')
        if first_cell_data is None or not first_cell_data.text:
            continue
            
        # Extract cell data
        row_data = []
        for cell in cells:
            data_el = cell.find(f'{ns}Data')
            val = data_el.text.strip() if (data_el is not None and data_el.text) else ""
            row_data.append(val)
            
        # Ensure row has enough columns
        if len(row_data) < 8:
            continue
            
        code = row_data[0]
        name = row_data[1]
        
        # Skip courses related to "práctica"
        normalized_name = name.upper().replace('Á','A').replace('É','E').replace('Í','I').replace('Ó','O').replace('Ú','U')
        if 'PRACTICA' in normalized_name:
            continue
            
        credits_str = row_data[2].strip()
        campus = row_data[3]
        section_name = row_data[4]
        event_type = row_data[5]
        schedule_str = row_data[6]
        professor = row_data[7]
        
        referenced = row_data[8] if len(row_data) > 8 else ""
        cat_paquete = row_data[9] if len(row_data) > 9 else ""
        paquete = row_data[10] if len(row_data) > 10 else ""
        vacancies_str = row_data[11].strip() if len(row_data) > 11 else ""
        
        # Init course if not exists
        if code not in courses:
            courses[code] = {
                'code': code,
                'name': name,
                'credits': int(float(credits_str)) if credits_str.replace('.','',1).isdigit() else 0,
                'campus': campus,
                'semester': get_semester(code, name),
                'sections': {}
            }
            
        course = courses[code]
        
        # Init section if not exists
        if section_name not in course['sections']:
            course['sections'][section_name] = {
                'section': section_name,
                'professor': professor,
                'events': [],
                'vacancies': int(vacancies_str) if vacancies_str.isdigit() else 0,
                'package': paquete,
                'referenced': referenced
            }
            
        section = course['sections'][section_name]
        
        # Add event info
        times = parse_schedule_time(schedule_str)
        section['events'].append({
            'type': event_type,
            'schedule_raw': schedule_str,
            'times': times
        })
        
        # Update professor if not set and available
        if professor and not section['professor']:
            section['professor'] = professor
            
    # Convert sections dict to a list for each course
    courses_list = []
    for code, course in courses.items():
        sections_list = []
        for sec_name, sec_data in course['sections'].items():
            sections_list.append(sec_data)
        course['sections'] = sections_list
        courses_list.append(course)
        
    # Write to JSON
    with open('courses_data.json', 'w', encoding='utf-8') as f:
        json.dump(courses_list, f, ensure_ascii=False, indent=2)
        
    # Write to JS
    with open('courses_data.js', 'w', encoding='utf-8') as f:
        f.write("const COURSES_DATA = ")
        json.dump(courses_list, f, ensure_ascii=False, indent=2)
        f.write(";\n")
        
    print(f"Successfully processed {len(courses_list)} unique courses and saved to courses_data.json & courses_data.js.")

if __name__ == "__main__":
    main()
