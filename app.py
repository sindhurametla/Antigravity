import os
import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

def parse_release_notes():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    response = requests.get(url, timeout=15)
    if response.status_code != 200:
        raise Exception(f"Failed to fetch release notes: HTTP {response.status_code}")
    
    # Parse Atom Feed XML
    namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
    root = ET.fromstring(response.content)
    
    entries = []
    
    for entry in root.findall('atom:entry', namespaces):
        title = entry.find('atom:title', namespaces)
        date_str = title.text.strip() if title is not None else "Unknown Date"
        
        updated = entry.find('atom:updated', namespaces)
        updated_str = updated.text.strip() if updated is not None else ""
        
        link = entry.find('atom:link[@rel="alternate"]', namespaces)
        href = link.attrib['href'] if link is not None else ""
        
        content_elem = entry.find('atom:content', namespaces)
        
        items = []
        if content_elem is not None and content_elem.text:
            html_content = content_elem.text
            soup = BeautifulSoup(html_content, 'html.parser')
            
            current_type = None
            current_nodes = []
            
            for child in soup.children:
                # NavigableString doesn't have a name
                if child.name == 'h3':
                    if current_type is not None:
                        # Package up previous item
                        html_str = "".join(str(c) for c in current_nodes).strip()
                        text_str = BeautifulSoup(html_str, 'html.parser').get_text().strip()
                        # Shorten spaces
                        text_str = " ".join(text_str.split())
                        items.append({
                            'type': current_type,
                            'html': html_str,
                            'text': text_str
                        })
                    current_type = child.get_text().strip()
                    current_nodes = []
                elif current_type is not None:
                    current_nodes.append(child)
            
            # Don't forget the last group
            if current_type is not None:
                html_str = "".join(str(c) for c in current_nodes).strip()
                text_str = BeautifulSoup(html_str, 'html.parser').get_text().strip()
                text_str = " ".join(text_str.split())
                items.append({
                    'type': current_type,
                    'html': html_str,
                    'text': text_str
                })
            
            # Fallback if no <h3> tags were found at all
            if not items:
                text_str = soup.get_text().strip()
                text_str = " ".join(text_str.split())
                items.append({
                    'type': 'General',
                    'html': html_content,
                    'text': text_str
                })
        else:
            items.append({
                'type': 'General',
                'html': '<p>No content details available.</p>',
                'text': 'No content details available.'
            })
            
        entries.append({
            'date': date_str,
            'updated': updated_str,
            'url': href,
            'items': items
        })
        
    return entries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def get_notes():
    try:
        notes = parse_release_notes()
        return jsonify({
            'status': 'success',
            'data': notes
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    # Start the server on port 5000
    app.run(debug=True, port=5000)
