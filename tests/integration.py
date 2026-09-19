#!/usr/bin/env python3
"""Exercise an isolated CRM through real HTTP APIs; no third-party Python dependencies."""
import argparse
import json
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--binary', required=True)
    args = parser.parse_args()
    binary = str(Path(args.binary).resolve())
    with tempfile.TemporaryDirectory(prefix='dealcontext-test-') as tmp:
        data = str(Path(tmp) / 'pb_data')
        common = [binary, '--dir', data, '--migrationsDir', str(ROOT / 'pb_migrations'), '--hooksDir', str(ROOT / 'pb_hooks')]
        subprocess.run(common + ['superuser', 'upsert', 'test-admin@example.com', 'TestAdminPassword123!'], cwd=ROOT, check=True, capture_output=True)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        base = f'http://127.0.0.1:{port}'
        log = open(Path(tmp) / 'server.log', 'w+')
        server = subprocess.Popen(common + ['serve', '--http', f'127.0.0.1:{port}'], cwd=ROOT, stdout=log, stderr=log)
        def request(method, path, body=None, token=None, expected=200):
            headers = {'Content-Type': 'application/json'}
            if token:
                headers['Authorization'] = token
            req = urllib.request.Request(base + path, data=None if body is None else json.dumps(body).encode(), headers=headers, method=method)
            try:
                with urllib.request.urlopen(req, timeout=10) as response:
                    status, raw = response.status, response.read()
            except urllib.error.HTTPError as error:
                status, raw = error.code, error.read()
            assert status == expected, (method, path, status, raw.decode())
            return json.loads(raw) if raw else None
        try:
            for _ in range(150):
                try:
                    request('GET', '/api/health')
                    break
                except (OSError, AssertionError):
                    if server.poll() is not None:
                        raise RuntimeError('Server exited during startup')
                    time.sleep(.1)
            else:
                raise RuntimeError('Server did not start')
            admin = request('POST', '/api/collections/_superusers/auth-with-password', {'identity': 'test-admin@example.com', 'password': 'TestAdminPassword123!'})['token']
            agent = request('POST', '/api/collections/agents/records', {'email': 'agent@example.com', 'password': 'TestAgentPassword123!', 'passwordConfirm': 'TestAgentPassword123!', 'name': 'Test agent'}, admin)
            token = request('POST', '/api/collections/agents/auth-with-password', {'identity': 'agent@example.com', 'password': 'TestAgentPassword123!'})['token']
            def create(collection, body):
                return request('POST', f'/api/collections/{collection}/records', body, token)
            request('POST', '/api/collections/organizations/records', {'name': 'Forbidden', 'owner': agent['id']}, expected=400)
            request('POST', '/api/collections/agents/records', {'name': 'Forbidden'}, token, expected=403)
            org = create('organizations', {'name': 'Acme', 'owner': agent['id']})
            person = create('people', {'name': 'Ada', 'email': 'ada@example.com', 'organization': org['id'], 'owner': agent['id']})
            pipeline = create('pipelines', {'name': 'Sales', 'active': True})
            first = create('stages', {'name': 'Qualified', 'pipeline': pipeline['id'], 'position': 0})
            second = create('stages', {'name': 'Negotiation', 'pipeline': pipeline['id'], 'position': 1})
            deal = create('deals', {'title': 'Acme renewal', 'stage': first['id'], 'person': person['id'], 'organization': org['id'], 'owner': agent['id'], 'value_minor': 250000, 'currency': 'USD', 'status': 'open'})
            request('PATCH', f'/api/collections/deals/records/{deal["id"]}', {'stage': second['id']}, token)
            activity = create('activities', {'subject': 'Follow up', 'kind': 'call', 'deal': deal['id'], 'owner': agent['id'], 'due_at': '2030-01-01 09:00:00.000Z'})
            create('notes', {'body': 'Customer requested a renewal proposal.', 'deal': deal['id'], 'owner': agent['id'], 'source_url': 'https://example.com/evidence'})
            schema = request('GET', '/api/context/schema', token=token)
            assert 'deals' in json.dumps(schema)
            result = request('POST', '/api/context/query', {'sql': "SELECT d.title,s.name AS stage,p.name AS person FROM deals d JOIN stages s ON s.id=d.stage JOIN people p ON p.id=d.person"}, token)
            assert 'Acme renewal' in json.dumps(result) and 'Negotiation' in json.dumps(result) and 'Ada' in json.dumps(result), result
            request('PATCH', f'/api/collections/activities/records/{activity["id"]}', {'done': True, 'completed_at': '2030-01-01 10:00:00.000Z'}, token)
            result = request('POST', '/api/context/query', {'sql': 'SELECT subject FROM activities WHERE done = 0'}, token)
            assert 'Follow up' not in json.dumps(result), result
            request('PATCH', f'/api/collections/deals/records/{deal["id"]}', {'status': 'won', 'closed_at': '2030-01-02 10:00:00.000Z'}, token)
            request('PATCH', f'/api/collections/deals/records/{deal["id"]}', {'value_minor': -1}, token, expected=400)
            request('PATCH', f'/api/collections/deals/records/{deal["id"]}', {'stage': 'missingstage123'}, token, expected=400)
            print('PASS: provisioning, CRM BaaS writes, authorization, validation, SQL joins, stage moves, activities, notes, closing deal')
        except Exception:
            log.flush()
            log.seek(0)
            print(log.read())
            raise
        finally:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
            log.close()


if __name__ == '__main__':
    main()
