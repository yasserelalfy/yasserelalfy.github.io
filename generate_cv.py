#!/usr/bin/env python3
"""Generate a professional PDF CV from content.json"""
import json
import os
import re
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
        self.set_auto_page_break(auto=True, margin=15)
        self.set_margins(MARGIN, 10, MARGIN) # Smaller top margin

    def header(self):
        # We only want the giant header on page 1
        pass

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(*COL_DIM)
        name = self.data['basics'].get('name', '')
        title = self.data.get('ui', {}).get('sections', {}).get('cvTitle', 'Curriculum Vitae')
        page_word = self.data.get('ui', {}).get('sections', {}).get('cvPage', 'Page')
        self.cell(0, 10, f'{name} - {title} - {page_word} {self.page_no()}/{{nb}}', align='C')

    def add_section_title(self, title):
        # Ensure section title isn't left alone at bottom
        if self.get_y() > 250:
            self.add_page()
        self.ln(4)
        self.set_font('Helvetica', 'B', 12)
        self.set_text_color(*COL_ACCENT)
        self.cell(0, 8, title.upper(), ln=1)
        self.set_draw_color(*COL_ACCENT)
        self.set_line_width(0.3)
        self.line(MARGIN, self.get_y(), PAGE_WIDTH - MARGIN, self.get_y())
        self.ln(2)

    def add_entry(self, left_text, right_text, details='', bullet_points=None, link=None):
        # Column safety: check height first
        if self.get_y() > 250:
            self.add_page()
            
        start_y = self.get_y()
        self.set_font('Helvetica', 'B', 10.5)
        self.set_text_color(*COL_TEXT)
        
        # Draw left part
        if link:
            self.set_text_color(*COL_ACCENT)
            self.write(5, left_text, link)
            self.set_text_color(*COL_TEXT)
            self.ln()
        else:
            self.multi_cell(130, 5, left_text)
        left_h = self.get_y() - start_y
        
        # Draw right part (reset back to start_y)
        self.set_xy(MARGIN + 130, start_y)
        self.set_font('Helvetica', '', 10)
        self.set_text_color(*COL_DIM)
        self.multi_cell(0, 5, right_text, align='R')
        right_h = self.get_y() - start_y
        
        # Sync Y (avoid negative jumps if one side wrapped more than others)
        self.set_y(start_y + max(left_h, right_h))
        
        if details:
            self.set_x(MARGIN + 5)
            self.set_font('Helvetica', 'I', 9.5)
            self.set_text_color(*COL_TEXT)
            self.multi_cell(0, 4.5, details)
            
        if bullet_points:
            self.set_font('Helvetica', '', 9.5)
            for bullet in bullet_points:
                self.set_x(MARGIN + 5)
                self.cell(4, 4.5, "- ")
                self.multi_cell(0, 4.5, bullet)
        self.ln(2)

def clean_data(d):
    if isinstance(d, dict):
        return {k: clean_data(v) for k, v in d.items()}
    elif isinstance(d, list):
        return [clean_data(v) for v in d]
    elif isinstance(d, str):
        s = d.replace('\u2013', '-').replace('\u2014', '-').replace('\u2018', "'").replace('\u2019', "'").replace('\u201c', '"').replace('\u201d', '"').replace('\u2026', '...')
        # Strip Markdown Links [Text](URL) -> Text
        s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1', s)
        # Strip Bold/Italics **Text** -> Text, *Text* -> Text
        s = re.sub(r'\*\*([^*]+)\*\*', r'\1', s)
        s = re.sub(r'\*([^*]+)\*', r'\1', s)
        return s
    return d

def generate_cv():
    with open(CONTENT_PATH, 'r', encoding='utf-8-sig') as f:
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
    metrics = basics.get('quickFactsMetrics', {})
    if metrics:
        ui_quick = data.get('ui', {}).get('quickFacts', {}).get('labels', {})
        pdf.set_font('Helvetica', 'B', 9.5)
        pdf.set_text_color(*COL_ACCENT)
        m_str = f"{ui_quick.get('citations', 'Citations')}: {metrics.get('citations','')}  |  {ui_quick.get('hIndex', 'h-index')}: {metrics.get('hIndex','')}  |  {ui_quick.get('i10Index', 'i10-index')}: {metrics.get('i10Index','')}"
        pdf.cell(0, 5, m_str, ln=1)

    # === EDUCATION ===
    ui_sections = data.get('ui', {}).get('sections', {})
    
    if data.get('education', {}).get('degrees'):
        pdf.add_section_title(ui_sections.get('education', 'Education'))
        for edu in data['education']['degrees']:
            pdf.add_entry(edu.get('degree', ''), f"{edu.get('institution', '')} | {edu.get('period', '')}", edu.get('details', ''))

    # === WORKSHOPS ===
    workshops = data.get('education', {}).get('workshops', [])
    if workshops:
        pdf.add_section_title(ui_sections.get('workshops', 'Workshops'))
        for w in workshops:
            pdf.add_entry(w.get('title', ''), f"{w.get('institution', '')} | {w.get('period', '')}")

    # === EXPERIENCE ===
    research = data.get('research', {})
    if data.get('education', {}).get('workExperience'):
        pdf.add_section_title(ui_sections.get('cvProfessionalExperience', 'Professional Experience'))
        for intern in data['education']['workExperience']:
            pdf.add_entry(intern.get('title', ''), f"{intern.get('institution', '')} | {intern.get('period', '')}")

    # === RESEARCH OVERVIEW ===
    if research.get('strategyOverview'):
        pdf.add_section_title(ui_sections.get('researchStrategy', 'Research Overview'))
        pdf.set_font('Helvetica', '', 10.5)
        pdf.set_text_color(*COL_TEXT)
        pdf.multi_cell(0, 5.5, research['strategyOverview'].get('text', ''))
        
        areas = research['strategyOverview'].get('researchAreas', [])
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
    skills = research.get('technicalSkills', {})
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

        if skills.get('os'):
            pdf.set_font('Helvetica', 'B', 10.5)
            pdf.cell(35, 6, ui_sections.get('cvOsTitle', 'OS:'))
            pdf.set_font('Helvetica', '', 10.5)
            pdf.multi_cell(0, 6, ui_sections.get('cvOsPrefix', 'Background in different Operating Systems: ') + ", ".join(skills['os']))

        if skills.get('otherSkills'):
            pdf.set_font('Helvetica', 'B', 10.5)
            pdf.cell(35, 6, ui_sections.get('cvOtherSkillsTitle', 'Other Skills:'))
            pdf.set_font('Helvetica', '', 10.5)
            pdf.multi_cell(0, 6, ", ".join(skills['otherSkills']))

    # === TEACHING ===
    teaching = data.get('teaching', {})
    if teaching.get('courses'):
        pdf.add_section_title(ui_sections.get('teachingProfile', 'Teaching'))
        for course in teaching['courses']:
            title = course.get('title', '')
            course_id = course.get('id', '')
            title_str = f"{course_id}: {title}" if course_id and title else (course_id or title)
            pdf.add_entry(title_str, course.get('period', ''))

    # === TALKS & EVENTS ===
    talks = teaching.get('talks', [])
    if talks:
        pdf.add_section_title(ui_sections.get('talksEvents', 'Talks & Events'))
        for talk in talks:
            pdf.add_entry(talk.get('title', ''), f"{talk.get('type', '')} | {talk.get('date', '')}", talk.get('location', ''))

    # === CERTIFICATES ===
    if data.get('education', {}).get('certificates'):
        pdf.add_section_title(ui_sections.get('cvCertifications', 'Certifications'))
        for cert in data['education']['certificates']:
            pdf.add_entry(cert.get('title', ''), cert.get('year', ''), cert.get('details', ''))

    # === PUBLICATIONS ===
    pubs = data.get('publications', {})
    articles = pubs.get('articles', [])
    if articles:
        pdf.add_section_title(ui_sections.get('cvSelectedPublications', 'Selected Publications'))
        pdf.set_font('Helvetica', '', 10)
        pdf.set_text_color(*COL_TEXT)
        for pub in articles:
            title = pub.get('title', '')
            venue = pub.get('venue', '')
            year = pub.get('year', '')
            url = pub.get('linkUrl', '')
            
            pdf.set_font('Helvetica', 'B', 10)
            if url and url != '#':
                pdf.set_text_color(*COL_ACCENT)
                pdf.write(5, title, url)
                pdf.ln()
            else:
                pdf.multi_cell(0, 5, title)
            
            pdf.set_font('Helvetica', 'I', 10)
            pdf.set_text_color(*COL_DIM)
            pdf.multi_cell(0, 5, f"{venue} ({year})" if year else venue)
            pdf.ln(3)
            pdf.set_text_color(*COL_TEXT)

    # === PATENTS ===
    patents = pubs.get('patents', [])
    if patents:
        pdf.add_section_title(data.get('ui', {}).get('filters', {}).get('patents', 'Patents'))
        for patent in patents:
            p_links = patent.get('links', [])
            url = p_links[0].get('url', '') if p_links else ''
            pdf.add_entry(patent.get('title', ''), f"{patent.get('id', '')}", link=url if url and url != '#' else None)

    # === DATASETS ===
    datasets = pubs.get('datasets', [])
    if datasets:
        pdf.add_section_title(data.get('ui', {}).get('filters', {}).get('datasets', 'Datasets'))
        pdf.set_font('Helvetica', '', 10)
        pdf.set_text_color(*COL_TEXT)
        for ds in datasets:
            title = ds.get('title', '')
            desc = ds.get('description', '')
            ds_links = ds.get('links', [])
            ds_url = ds_links[0].get('url', '') if ds_links else ''
            
            pdf.set_font('Helvetica', 'B', 10)
            if ds_url:
                pdf.set_text_color(*COL_ACCENT)
                pdf.write(5, title, ds_url)
                pdf.ln()
            else:
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
