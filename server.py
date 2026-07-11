import http.server
import json
import os
import urllib.parse

PORT = 8080

REGISTRATIONS_FILE = 'registrations.json'
USERS_FILE = 'users.json'

# Ensure files exist
if not os.path.exists(REGISTRATIONS_FILE):
    with open(REGISTRATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f)

if not os.path.exists(USERS_FILE):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump({}, f)

def read_json(filename):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return [] if filename == REGISTRATIONS_FILE else {}

def write_json(filename, data):
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

class DebateHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent caching for development convenience
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        # 1. API: Get all registrations
        if path == '/api/registrations':
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            data = read_json(REGISTRATIONS_FILE)
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
            return

        # 2. API: Get user status
        elif path == '/api/user-status':
            phone = query_params.get('phone', [None])[0]
            if not phone:
                self.send_response(400)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'phone parameter is required'}, ensure_ascii=False).encode('utf-8'))
                return

            users = read_json(USERS_FILE)
            if phone in users:
                res = {'status': users[phone].get('status', 'Не куплен'), 'name': users[phone].get('firstName', '')}
            else:
                res = {'status': 'Не куплен', 'name': ''}

            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode('utf-8'))
            return

        # Fallback to serving static files
        super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        content_length = int(self.headers['Content-Length'] or 0)
        post_data = self.rfile.read(content_length).decode('utf-8')

        try:
            body = json.loads(post_data) if post_data else {}
        except Exception:
            self.send_response(400)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Invalid JSON body'}, ensure_ascii=False).encode('utf-8'))
            return

        # 1. API: Register student
        if path == '/api/register':
            first_name = body.get('firstName')
            last_name = body.get('lastName')
            phone = body.get('phoneNumber')

            if not first_name or not last_name or not phone:
                self.send_response(400)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Missing name or phone'}, ensure_ascii=False).encode('utf-8'))
                return

            registrations = read_json(REGISTRATIONS_FILE)
            import time
            new_reg = {
                'id': str(int(time.time() * 1000)),
                'firstName': first_name,
                'lastName': last_name,
                'phoneNumber': phone,
                'slots': body.get('slots', []),
                'courseLevel': body.get('courseLevel', 'Не выбран'),
                'format': body.get('format', 'Не выбран'),
                'language': body.get('language', 'Не выбран'),
                'selectedLectures': body.get('selectedLectures', []),
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            }
            registrations.append(new_reg)
            write_json(REGISTRATIONS_FILE, registrations)

            # Ensure user status in users.json
            users = read_json(USERS_FILE)
            if phone not in users:
                users[phone] = {
                    'firstName': first_name,
                    'lastName': last_name,
                    'status': 'Не куплен',
                    'updatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                }
                write_json(USERS_FILE, users)

            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'registration': new_reg}, ensure_ascii=False).encode('utf-8'))
            return

        # 2. API: Clear all registrations
        elif path == '/api/registrations/clear':
            write_json(REGISTRATIONS_FILE, [])
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'message': 'Все заявки удалены'}, ensure_ascii=False).encode('utf-8'))
            return

        # 3. API: Update user status
        elif path == '/api/user-status':
            phone = body.get('phoneNumber')
            status = body.get('status')

            if not phone or not status:
                self.send_response(400)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'phoneNumber and status are required'}, ensure_ascii=False).encode('utf-8'))
                return

            import time
            users = read_json(USERS_FILE)
            if phone not in users:
                users[phone] = {
                    'firstName': body.get('firstName', 'Пользователь'),
                    'lastName': body.get('lastName', ''),
                    'status': status,
                    'updatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                }
            else:
                users[phone]['status'] = status
                if body.get('firstName'): users[phone]['firstName'] = body.get('firstName')
                if body.get('lastName'): users[phone]['lastName'] = body.get('lastName')
                users[phone]['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())

            write_json(USERS_FILE, users)
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'user': users[phone]}, ensure_ascii=False).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

if __name__ == '__main__':
    server_address = ('', PORT)
    httpd = http.server.HTTPServer(server_address, DebateHTTPRequestHandler)
    print(f"Python custom HTTP server is running at http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
