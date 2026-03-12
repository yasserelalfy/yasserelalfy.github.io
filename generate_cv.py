#!/usr/bin/env python3
"""Generate a professional PDF CV from content.json"""
import json
import os
from fpdf import FPDF

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONTENT_PATH = os.path.join(SCRIPT_DIR, 'content.json')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'outputs')
OUTPUT_FILE = os.path.join(OUTPUT_DIR, 'CV_Generated.pdf')

PAGE_WIDTH = 210
PAGE_HEIGHT = 297
MARGIN = 15

# New Elegant Academic Theme
COL_TEXT = (25, 25, 30)
COL_ACCENT = (20, 80, 120)  # Classic Navy/Steel Blue
COL_DIM = (100, 100, 110)

class ClassicCV(FPDF):
    def __init__(self, data):
        super().__init__()
        self.data = data
        self.set_auto_page_break(auto=True, margin=20)
        self.set_margins(MARGIN, MARGIN, MARGIN)

    def header(self):
        # We only want the giant header on page 1
        pass

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(*COL_DIM)
        name = self.data['basics'].get('name', '')
        title = self.data.get('ui', {}).get('sections', {}).get('cvTitle', 'Curriculum Vitae')
        self.cell(0, 10, f'{name} - {title} - Page {self.page_no()}/{{nb}}', align='C')

    def add_section_title(self, title):
        self.ln(6)
        self.set_font('Helvetica', 'B', 14)
        self.set_text_color(*COL_ACCENT)
        self.cell(0, 8, title.upper(), ln=1)
        self.set_draw_color(*COL_ACCENT)
        self.set_line_width(0.4)
        self.line(MARGIN, self.get_y(), PAGE_WIDTH - MARGIN, self.get_y())
        self.ln(4)

    def add_entry(self, left_text, right_text, details='', bullet_points=None):
        self.set_font('Helvetica', 'B', 11)
        self.set_text_color(*COL_TEXT)
        
        # Save X and Y
        start_y = self.get_y()
        self.set_x(MARGIN)
        self.multi_cell(125, 6, left_text)
        left_h = self.get_y() - start_y
        
        self.set_xy(MARGIN + 125, start_y)
        self.set_font('Helvetica', '', 10)
        self.set_text_color(*COL_DIM)
        self.multi_cell(0, 6, right_text, align='R')
        right_h = self.get_y() - start_y
        
        # Advance y past whichever side was taller
        self.set_y(start_y + max(left_h, right_h))
        
        if details:
            self.set_x(MARGIN + 5)
            self.set_font('Helvetica', 'I', 10)
            self.set_text_color(*COL_TEXT)
            self.multi_cell(0, 5, details)
            
        if bullet_points:
            self.set_font('Helvetica', '', 10)
            self.set_text_color(*COL_TEXT)
            for bullet in bullet_points:
                self.set_x(MARGIN + 5)
                self.cell(5, 5, "- ")
                self.multi_cell(0, 5, bullet)
        self.ln(3)

def clean_data(d):
    if isinstance(d, dict):
        return {k: clean_data(v) for k, v in d.items()}
    elif isinstance(d, list):
        return [clean_data(v) for v in d]
    elif isinstance(d, str):
        return d.replace('\u2013', '-').replace('\u2014', '-').replace('\u2018', "'").replace('\u2019', "'").replace('\u201c', '"').replace('\u201d', '"').replace('\u2026', '...')
    return d

def generate_cv():
    with open(CONTENT_PATH, 'r', encoding='utf-8') as f:
        data = clean_data(json.load(f))
    
    basics = data['basics']
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    pdf = ClassicCV(data)
    pdf.alias_nb_pages()
    pdf.add_page()
    
    # === HEADER ===
    photo_w = 0
    photo_path = basics.get('photoUrl', '')
    if photo_path:
        full_photo_path = os.path.join(SCRIPT_DIR, photo_path)
        if os.path.exists(full_photo_path):
            photo_w = 30
            # Draw photo on top right
            pdf.image(full_photo_path, x=PAGE_WIDTH - MARGIN - photo_w, y=MARGIN, w=photo_w, h=photo_w + 5)
    
    # Name
    pdf.set_y(MARGIN)
    pdf.set_font('Helvetica', 'B', 24)
    pdf.set_text_color(*COL_TEXT)
    # Multi cell prevents name from overflowing by automatically wrapping it and scaling down if we want
    # We restrict width so it doesn't overlap the photo
    pdf.multi_cell(PAGE_WIDTH - (MARGIN*2) - photo_w - 5, 10, basics.get('name', '').upper())
    
    # Role & Affiliation
    pdf.set_font('Helvetica', 'I', 12)
    pdf.set_text_color(*COL_ACCENT)
    pdf.multi_cell(PAGE_WIDTH - (MARGIN*2) - photo_w - 5, 6, f"{basics.get('role', '')} | {basics.get('affiliation', '')}")
    pdf.ln(2)
    
    # Contact Row
    pdf.set_font('Helvetica', '', 9.5)
    pdf.set_text_color(*COL_DIM)
    
    contacts = []
    if basics.get('emailUni'): contacts.append((basics['emailUni'], f"mailto:{basics['emailUni']}"))
    if basics.get('emailPersonal'): contacts.append((basics['emailPersonal'], f"mailto:{basics['emailPersonal']}"))
    if basics.get('linkedinUrl'): contacts.append(("LinkedIn", basics['linkedinUrl']))
    if basics.get('scholarUrl'): contacts.append(("Google Scholar", basics['scholarUrl']))
    
    for i, (text, url) in enumerate(contacts):
        width = pdf.get_string_width(text) + 2
        pdf.set_text_color(*COL_ACCENT)
        pdf.cell(width, 5, text, link=url)
        
        if i < len(contacts) - 1:
            pdf.set_text_color(*COL_DIM)
            sep_width = pdf.get_string_width("  |  ") + 2
            pdf.cell(sep_width, 5, "  |  ")
    
    pdf.ln(5)
    
    # Space after header to clear photo
    current_y = pdf.get_y()
    if photo_w > 0 and current_y < MARGIN + photo_w + 10:
        pdf.set_y(MARGIN + photo_w + 10)
    else:
        pdf.ln(6)

    # Bio
    if basics.get('shortBio'):
        pdf.set_font('Helvetica', '', 10.5)
        pdf.set_text_color(*COL_TEXT)
        pdf.multi_cell(0, 5.5, basics['shortBio'])
        pdf.ln(3)

    # Metrics
    metrics = basics.get('metrics', {})
    if metrics:
        ui_quick = data.get('ui', {}).get('quickFacts', {}).get('labels', {})
        pdf.set_font('Helvetica', 'B', 9.5)
        pdf.set_text_color(*COL_ACCENT)
        m_str = f"{ui_quick.get('citations', 'Citations')}: {metrics.get('citations','')}  |  {ui_quick.get('hIndex', 'h-index')}: {metrics.get('hIndex','')}  |  {ui_quick.get('i10Index', 'i10-index')}: {metrics.get('i10Index','')}"
        pdf.cell(0, 5, m_str, ln=1)

    # === EDUCATION ===
    ui_sections = data.get('ui', {}).get('sections', {})
    
    if data.get('education'):
        pdf.add_section_title(ui_sections.get('education', 'Education'))
        for edu in data['education']:
            pdf.add_entry(edu.get('degree', ''), f"{edu.get('institution', '')} | {edu.get('period', '')}", edu.get('details', ''))

    # === EXPERIENCE ===
    research = data.get('research', {})
    if research.get('internships'):
        pdf.add_section_title(ui_sections.get('professionalInternships', 'Professional Experience'))
        for intern in research['internships']:
            pdf.add_entry(intern.get('title', ''), f"{intern.get('institution', '')} | {intern.get('period', '')}")

    # === RESEARCH OVERVIEW ===
    if research.get('overview'):
        pdf.add_section_title(ui_sections.get('researchStrategy', 'Research Overview'))
        pdf.set_font('Helvetica', '', 10.5)
        pdf.set_text_color(*COL_TEXT)
        pdf.multi_cell(0, 5.5, research['overview'].get('text', ''))
        
        areas = research['overview'].get('researchAreas', [])
        if areas:
            pdf.ln(3)
            pdf.set_font('Helvetica', 'B', 10)
            pdf.cell(0, 6, ui_sections.get('cvFocusAreas', 'Key Focus Areas:'), ln=1)
            pdf.set_font('Helvetica', '', 10)
            for area in areas:
                pdf.set_x(MARGIN + 5)
                pdf.cell(5, 5, "- ")
                pdf.multi_cell(0, 5, area)

    # === SKILLS ===
    skills = data.get('technicalSkills', {})
    if skills:
        pdf.add_section_title(ui_sections.get('technicalSkills', 'Technical Skills'))
        pdf.set_font('Helvetica', '', 10.5)
        pdf.set_text_color(*COL_TEXT)
        
        if skills.get('languages'):
            pdf.set_font('Helvetica', 'B', 10.5)
            pdf.cell(35, 6, ui_sections.get('cvLanguages', 'Languages:'))
            pdf.set_font('Helvetica', '', 10.5)
            pdf.multi_cell(0, 6, ", ".join(skills['languages']))
            
        if skills.get('software'):
            pdf.set_font('Helvetica', 'B', 10.5)
            pdf.cell(35, 6, ui_sections.get('cvSoftware', 'Software:'))
            pdf.set_font('Helvetica', '', 10.5)
            pdf.multi_cell(0, 6, ", ".join(skills['software']))

    # === TEACHING ===
    teaching = data.get('teaching', {})
    if teaching.get('courses'):
        pdf.add_section_title(ui_sections.get('teachingProfile', 'Teaching'))
        for course in teaching['courses']:
            title_str = f"{course.get('id', '')}: {course.get('title', '')}" if course.get('id') else course.get('title', '')
            pdf.add_entry(title_str, course.get('period', ''))

    # === CERTIFICATES ===
    if data.get('certificates'):
        pdf.add_section_title(ui_sections.get('certificates', 'Certifications'))
        for cert in data['certificates']:
            pdf.add_entry(cert.get('title', ''), cert.get('year', ''), cert.get('details', ''))

    # === PUBLICATIONS ===
    pubs = data.get('publications', {})
    articles = pubs.get('articles', [])
    if articles:
        pdf.add_section_title(ui_sections.get('scientificContributions', 'Selected Publications'))
        pdf.set_font('Helvetica', '', 10)
        pdf.set_text_color(*COL_TEXT)
        for pub in articles:
            title = pub.get('title', '')
            venue = pub.get('venue', '')
            year = pub.get('year', '')
            
            pdf.set_font('Helvetica', 'B', 10)
            pdf.multi_cell(0, 5, title)
            
            pdf.set_font('Helvetica', 'I', 10)
            pdf.set_text_color(*COL_DIM)
            pdf.multi_cell(0, 5, f"{venue} ({year})" if year else venue)
            pdf.ln(3)
            pdf.set_text_color(*COL_TEXT)

    # === DATASETS ===
    datasets = pubs.get('datasets', [])
    if datasets:
        pdf.add_section_title(data.get('ui', {}).get('filters', {}).get('datasets', 'Datasets'))
        pdf.set_font('Helvetica', '', 10)
        pdf.set_text_color(*COL_TEXT)
        for ds in datasets:
            title = ds.get('title', '')
            desc = ds.get('description', '')
            
            pdf.set_font('Helvetica', 'B', 10)
            pdf.multi_cell(0, 5, title)
            
            if desc:
                pdf.set_font('Helvetica', 'I', 10)
                pdf.set_text_color(*COL_DIM)
                pdf.multi_cell(0, 5, desc)
                
            pdf.ln(3)
            pdf.set_text_color(*COL_TEXT)

    pdf.output(OUTPUT_FILE)
    print(f"CV generated: {OUTPUT_FILE}")
    print(f"Pages: {pdf.page_no()}")

if __name__ == '__main__':
    generate_cv()
