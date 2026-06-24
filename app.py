import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def fetch_and_parse_feed():
    req = urllib.request.Request(
        FEED_URL, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    )
    with urllib.request.urlopen(req) as response:
        xml_data = response.read()
    
    root = ET.fromstring(xml_data)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    # Get feed level details
    feed_title = root.find('atom:title', ns)
    feed_updated = root.find('atom:updated', ns)
    
    parsed_entries = []
    for entry in root.findall('atom:entry', ns):
        title = entry.find('atom:title', ns)
        updated = entry.find('atom:updated', ns)
        link = entry.find('atom:link', ns)
        content = entry.find('atom:content', ns)
        entry_id = entry.find('atom:id', ns)
        
        href = link.attrib.get('href', '') if link is not None else ''
        
        parsed_entries.append({
            'id': entry_id.text if entry_id is not None else '',
            'title': title.text if title is not None else '',
            'updated': updated.text if updated is not None else '',
            'link': href,
            'content': content.text if content is not None else ''
        })
        
    return {
        'title': feed_title.text if feed_title is not None else 'BigQuery Release Notes',
        'updated': feed_updated.text if feed_updated is not None else '',
        'entries': parsed_entries
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def release_notes_api():
    try:
        data = fetch_and_parse_feed()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
