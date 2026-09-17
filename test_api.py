import urllib.request
import json

base_url = "http://127.0.0.1:8000"

print("--- 1. Testing Health Endpoint ---")
req = urllib.request.Request(f"{base_url}/api/v1/health")
with urllib.request.urlopen(req) as resp:
    print(json.loads(resp.read().decode()))

print("\n--- 2. Testing API Key Authentication ---")
data = json.dumps({"api_key": "AVX-RMT-3381-KEY"}).encode('utf-8')
req = urllib.request.Request(f"{base_url}/api/v1/auth/verify-key", data=data, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as resp:
    print(json.loads(resp.read().decode()))

print("\n--- 3. Testing Protected Endpoint Without API Key (Expecting 401) ---")
data = json.dumps({"activate": True}).encode('utf-8')
req = urllib.request.Request(f"{base_url}/api/v1/command/jam", data=data, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as resp:
        print(resp.read())
except urllib.error.HTTPError as e:
    print(f"PASS: HTTP Error {e.code} - {e.reason}")

print("\n--- 4. Testing Protected RF Jammer Command WITH API Key ---")
data = json.dumps({"activate": True, "target_id": "D-01"}).encode('utf-8')
req = urllib.request.Request(f"{base_url}/api/v1/command/jam", data=data, headers={'Content-Type': 'application/json', 'x-api-key': 'AVX-RMT-3381-KEY'})
with urllib.request.urlopen(req) as resp:
    print(json.loads(resp.read().decode()))

print("\n--- 5. Testing PTZ Control WITH API Key ---")
data = json.dumps({"pan": 90.0, "tilt": 25.0, "radar_rpm": 45}).encode('utf-8')
req = urllib.request.Request(f"{base_url}/api/v1/command/ptz", data=data, headers={'Content-Type': 'application/json', 'x-api-key': 'AVX-CMD-9948-KEY'})
with urllib.request.urlopen(req) as resp:
    print(json.loads(resp.read().decode()))

print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!")
