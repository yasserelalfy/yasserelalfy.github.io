import json
import os
from scholarly import scholarly

# Configuration
CONTENT_PATH = 'content.json'

def sync_scholar():
    # Load existing content first to get Scholar ID
    with open(CONTENT_PATH, 'r', encoding='utf-8-sig') as f:
        content = json.load(f)
    
    SCHOLAR_ID = content['basics'].get('scholarId', '')
    if not SCHOLAR_ID:
        print("Error: No scholarId found in content.json basics section.")
        return
    
    print(f"Fetching updates for Scholar ID: {SCHOLAR_ID}...")
    
    try:
        author = scholarly.search_author_id(SCHOLAR_ID)
        scholarly.fill(author, sections=['basics', 'publications', 'indices'])
        
        # 1. Update Metrics
        content['basics']['quickFactsMetrics'] = {
            "citations": str(author.get('citedby', '0')),
            "hIndex": str(author.get('hindex', '0')),
            "hIndex5y": str(author.get('hindex5y', '0')),
            "i10Index": str(author.get('i10index', '0')),
            "i10Index5y": str(author.get('i10index5y', '0'))
        }
        print(f"Metrics updated: Citations={content['basics']['quickFactsMetrics']['citations']}, h-index={content['basics']['quickFactsMetrics']['hIndex']}")

        # 2. Sync Publications
        existing_articles = content.get('publications', {}).get('articles', [])
        article_by_title = {art['title'].lower().strip(): art for art in existing_articles}
        
        new_count = 0
        updated_count = 0
        for pub in author['publications']:
            title = pub['bib']['title']
            year = pub['bib'].get('pub_year', 'Unknown')
            
            try:
                scholarly.fill(pub)
            except Exception as e:
                print(f"Failed to extract full publication details for: {title}")
                
            pub_url = pub.get('pub_url')
            # Fallback to the scholar page if pub_url is missing
            if not pub_url and 'author_pub_id' in pub:
                pub_url = f"https://scholar.google.com/citations?view_op=view_citation&hl=en&user={SCHOLAR_ID}&citation_for_view={pub['author_pub_id']}"
            elif not pub_url:
                pub_url = "#"
                
            link_text = "Google Scholar" if "scholar.google" in pub_url else "Full Text"
            
            norm_title = title.lower().strip()
            if norm_title in article_by_title:
                art = article_by_title[norm_title]
                if art.get('linkUrl') != pub_url or art.get('linkUrl') == '#':
                    art['linkUrl'] = pub_url
                    if pub_url != '#':
                        art['linkText'] = link_text
                    updated_count += 1
            else:
                print(f"New publication found: {title}")
                
                new_item = {
                    "title": title,
                    "venue": pub['bib'].get('citation', 'Google Scholar'),
                    "year": str(year),
                    "linkText": link_text,
                    "linkUrl": pub_url,
                    "type": "article",
                    "category": "Unknown"
                }
                
                content['publications']['articles'].append(new_item)
                article_by_title[norm_title] = new_item
                new_count += 1
        
        # Save updated content
        with open(CONTENT_PATH, 'w', encoding='utf-8') as f:
            json.dump(content, f, indent=2, ensure_ascii=False)
            
        print(f"Sync complete. Added {new_count} new publications and updated {updated_count} existing links.")
            
    except Exception as e:
        print(f"Error during sync: {e}")

if __name__ == "__main__":
    sync_scholar()
