import json
import os
import sys
import traceback
from scholarly import scholarly, ProxyGenerator

# Set up Proxy Generator to avoid GitHub Actions IP blocking
if os.getenv('GITHUB_ACTIONS'):
    pg = ProxyGenerator()
    try:
        print("Running in GitHub Actions. Setting up free proxy for Google Scholar...")
        if pg.FreeProxies():
            scholarly.use_proxy(pg)
            print("Proxy setup successful.")
        else:
            print("Failed to find a working FreeProxy. Proceeding without proxy (might get blocked).")
    except Exception as e:
        print(f"Proxy setup encountered an error: {e}")
else:
    print("Running locally. Skipping proxy to avoid slow execution and connection issues.")

# Configuration
CONTENT_PATH = 'content.json'

def safe_get(obj, key, default=None):
    """Safely get values from either a dict or an object, handling None appropriately."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        val = obj.get(key, default)
        return val if val is not None else default
    val = getattr(obj, key, default)
    return val if val is not None else default

def sync_scholar():
    # Load existing content first to get Scholar ID
    with open(CONTENT_PATH, 'r', encoding='utf-8-sig') as f:
        content = json.load(f)
    
    basics = content.get('basics') or {}
    SCHOLAR_ID = basics.get('scholarId', '')
    if not SCHOLAR_ID:
        print("Error: No scholarId found in content.json basics section.")
        return
    
    print(f"Fetching updates for Scholar ID: {SCHOLAR_ID}...")
    
    try:
        author = scholarly.search_author_id(SCHOLAR_ID)
        if author is None:
            print("Error: scholarly returned None. You may be rate-limited by Google.")
            return

        print("Fetching author details. This might take a few moments...")
        scholarly.fill(author, sections=['basics', 'publications', 'indices'])
        
        # 1. Update Metrics
        content['basics']['quickFactsMetrics'] = {
            "citations": str(safe_get(author, 'citedby', '0')),
            "hIndex": str(safe_get(author, 'hindex', '0')),
            "hIndex5y": str(safe_get(author, 'hindex5y', '0')),
            "i10Index": str(safe_get(author, 'i10index', '0')),
            "i10Index5y": str(safe_get(author, 'i10index5y', '0'))
        }
        print(f"Metrics updated: Citations={content['basics']['quickFactsMetrics']['citations']}, h-index={content['basics']['quickFactsMetrics']['hIndex']}")

        # 2. Sync Publications
        publications_data = content.get('publications') or {}
        existing_articles = publications_data.get('articles') or []
        article_by_title = {art.get('title', '').lower().strip(): art for art in existing_articles if isinstance(art, dict)}
        
        new_count = 0
        updated_count = 0
        
        author_pubs = safe_get(author, 'publications', [])
        for pub in author_pubs:
            if pub is None:
                continue
            bib = safe_get(pub, 'bib', {})
            title = safe_get(bib, 'title', '')
            if not title:
                continue
                
            year = safe_get(bib, 'pub_year', 'Unknown')
            
            norm_title = title.lower().strip()
            art = article_by_title.get(norm_title)
            
            # Optimization: Skip expensive HTTP request if we already have the URL
            if art and art.get('linkUrl') and art.get('linkUrl') != '#':
                continue
            
            try:
                scholarly.fill(pub)
            except Exception as e:
                print(f"Failed to extract full publication details for '{title}': {e}")
                
            pub_url = safe_get(pub, 'pub_url')
            # Fallback to the scholar page if pub_url is missing
            author_pub_id = safe_get(pub, 'author_pub_id')
            if not pub_url and author_pub_id:
                pub_url = f"https://scholar.google.com/citations?view_op=view_citation&hl=en&user={SCHOLAR_ID}&citation_for_view={author_pub_id}"
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
                    "venue": safe_get(bib, 'citation', 'Google Scholar'),
                    "year": str(year),
                    "linkText": link_text,
                    "linkUrl": pub_url,
                    "type": "article",
                    "category": "Unknown"
                }
                
                if 'articles' not in content['publications']:
                    content['publications']['articles'] = []
                content['publications']['articles'].append(new_item)
                article_by_title[norm_title] = new_item
                new_count += 1
        
        # Save updated content
        with open(CONTENT_PATH, 'w', encoding='utf-8') as f:
            json.dump(content, f, indent=2, ensure_ascii=False)
            
        print(f"Sync complete. Added {new_count} new publications and updated {updated_count} existing links.")
            
    except AttributeError as e:
        print(f"\nError during sync: {e}")
        print("Note: An AttributeError in 'scholarly' often means Google Scholar blocked the request ")
        print("(e.g., returned a CAPTCHA page) causing parsing to fail. Try again later or use proxies.")
        traceback.print_exc()
        sys.exit(1)
    except Exception as e:
        print(f"\nError during sync: {e}")
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    sync_scholar()
