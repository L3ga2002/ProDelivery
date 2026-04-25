#!/usr/bin/env python3
"""
Backend API Testing for Driver Ranking Application
Testing the seed endpoint and authentication flows after environment variable changes.
"""

import requests
import json
import os
import sys
from typing import Dict, Any

# Get the backend URL from frontend environment
BACKEND_URL = "https://driver-ranking-1.preview.emergentagent.com/api"

# Test credentials from environment variables (matching backend .env)
TEST_CREDENTIALS = {
    "admin": {
        "email": "admin@delivery.ro",
        "password": "admin123"
    },
    "driver_001": {
        "email": "driver-001@delivery.ro", 
        "password": "driver123"
    },
    "restaurant_001": {
        "email": "rest-001@delivery.ro",
        "password": "restaurant123"
    }
}

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
        print()
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response": response_data if not success else None
        })
    
    def test_seed_endpoint(self):
        """Test POST /api/seed endpoint"""
        print("🧪 Testing POST /api/seed endpoint...")
        
        try:
            response = self.session.post(f"{BACKEND_URL}/seed")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response contains expected structure
                if "message" in data and "credentials" in data and "data" in data:
                    # Validate credentials structure
                    creds = data["credentials"]
                    expected_keys = ["admin", "drivers", "restaurants"]
                    
                    if all(key in creds for key in expected_keys):
                        # Check admin credentials match environment
                        admin_creds = creds["admin"]
                        if (admin_creds["email"] == TEST_CREDENTIALS["admin"]["email"] and 
                            admin_creds["password"] == TEST_CREDENTIALS["admin"]["password"]):
                            
                            self.log_test("Seed endpoint returns 200 with valid credentials", True, 
                                        f"Message: {data['message']}, Data: {data['data']}")
                        else:
                            self.log_test("Seed endpoint returns 200 with valid credentials", False,
                                        f"Admin credentials don't match environment variables", data)
                    else:
                        self.log_test("Seed endpoint returns 200 with valid credentials", False,
                                    f"Missing credential keys: {expected_keys}", data)
                else:
                    self.log_test("Seed endpoint returns 200 with valid credentials", False,
                                "Response missing required keys: message, credentials, data", data)
            else:
                self.log_test("Seed endpoint returns 200 with valid credentials", False,
                            f"HTTP {response.status_code}: {response.text}", response.text)
                
        except Exception as e:
            self.log_test("Seed endpoint returns 200 with valid credentials", False,
                        f"Request failed: {str(e)}")
    
    def test_admin_login(self):
        """Test admin login with demo credentials"""
        print("🧪 Testing admin login...")
        
        try:
            login_data = {
                "email": TEST_CREDENTIALS["admin"]["email"],
                "password": TEST_CREDENTIALS["admin"]["password"]
            }
            
            response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                
                if "token" in data and "user" in data:
                    user = data["user"]
                    if (user.get("email") == TEST_CREDENTIALS["admin"]["email"] and 
                        user.get("role") == "admin"):
                        
                        self.admin_token = data["token"]
                        self.log_test("Admin login with demo credentials", True,
                                    f"User: {user['name']} ({user['email']}) - Role: {user['role']}")
                    else:
                        self.log_test("Admin login with demo credentials", False,
                                    f"User data incorrect: {user}", data)
                else:
                    self.log_test("Admin login with demo credentials", False,
                                "Response missing token or user", data)
            else:
                self.log_test("Admin login with demo credentials", False,
                            f"HTTP {response.status_code}: {response.text}", response.text)
                
        except Exception as e:
            self.log_test("Admin login with demo credentials", False,
                        f"Request failed: {str(e)}")
    
    def test_driver_login(self):
        """Test driver login with demo credentials"""
        print("🧪 Testing driver-001 login...")
        
        try:
            login_data = {
                "email": TEST_CREDENTIALS["driver_001"]["email"],
                "password": TEST_CREDENTIALS["driver_001"]["password"]
            }
            
            response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                
                if "token" in data and "user" in data:
                    user = data["user"]
                    if (user.get("email") == TEST_CREDENTIALS["driver_001"]["email"] and 
                        user.get("role") == "driver"):
                        
                        self.log_test("Driver-001 login with demo credentials", True,
                                    f"User: {user['name']} ({user['email']}) - Role: {user['role']}, Driver ID: {user.get('driver_id')}")
                    else:
                        self.log_test("Driver-001 login with demo credentials", False,
                                    f"User data incorrect: {user}", data)
                else:
                    self.log_test("Driver-001 login with demo credentials", False,
                                "Response missing token or user", data)
            else:
                self.log_test("Driver-001 login with demo credentials", False,
                            f"HTTP {response.status_code}: {response.text}", response.text)
                
        except Exception as e:
            self.log_test("Driver-001 login with demo credentials", False,
                        f"Request failed: {str(e)}")
    
    def test_restaurant_login(self):
        """Test restaurant login with demo credentials"""
        print("🧪 Testing restaurant-001 login...")
        
        try:
            login_data = {
                "email": TEST_CREDENTIALS["restaurant_001"]["email"],
                "password": TEST_CREDENTIALS["restaurant_001"]["password"]
            }
            
            response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                
                if "token" in data and "user" in data:
                    user = data["user"]
                    if (user.get("email") == TEST_CREDENTIALS["restaurant_001"]["email"] and 
                        user.get("role") == "restaurant"):
                        
                        self.log_test("Restaurant-001 login with demo credentials", True,
                                    f"User: {user['name']} ({user['email']}) - Role: {user['role']}, Restaurant ID: {user.get('restaurant_id')}")
                    else:
                        self.log_test("Restaurant-001 login with demo credentials", False,
                                    f"User data incorrect: {user}", data)
                else:
                    self.log_test("Restaurant-001 login with demo credentials", False,
                                "Response missing token or user", data)
            else:
                self.log_test("Restaurant-001 login with demo credentials", False,
                            f"HTTP {response.status_code}: {response.text}", response.text)
                
        except Exception as e:
            self.log_test("Restaurant-001 login with demo credentials", False,
                        f"Request failed: {str(e)}")
    
    def test_zones_endpoint(self):
        """Test GET /api/zones with admin token"""
        print("🧪 Testing GET /api/zones with admin token...")
        
        if not self.admin_token:
            self.log_test("GET /api/zones with admin token", False,
                        "No admin token available (admin login failed)")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{BACKEND_URL}/zones", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list) and len(data) > 0:
                    # Check if zones have expected structure
                    first_zone = data[0]
                    expected_keys = ["id", "sector", "zone_level", "name", "color", "fee", "polygon"]
                    
                    if all(key in first_zone for key in expected_keys):
                        self.log_test("GET /api/zones with admin token", True,
                                    f"Retrieved {len(data)} zones successfully")
                    else:
                        self.log_test("GET /api/zones with admin token", False,
                                    f"Zone structure missing keys: {expected_keys}", first_zone)
                else:
                    self.log_test("GET /api/zones with admin token", False,
                                "Empty zones list or invalid format", data)
            else:
                self.log_test("GET /api/zones with admin token", False,
                            f"HTTP {response.status_code}: {response.text}", response.text)
                
        except Exception as e:
            self.log_test("GET /api/zones with admin token", False,
                        f"Request failed: {str(e)}")
    
    def test_drivers_endpoint(self):
        """Test GET /api/drivers with admin token"""
        print("🧪 Testing GET /api/drivers with admin token...")
        
        if not self.admin_token:
            self.log_test("GET /api/drivers with admin token", False,
                        "No admin token available (admin login failed)")
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{BACKEND_URL}/drivers", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list) and len(data) > 0:
                    # Check if drivers have expected structure
                    first_driver = data[0]
                    expected_keys = ["id", "name", "phone", "is_active", "latitude", "longitude"]
                    
                    if all(key in first_driver for key in expected_keys):
                        self.log_test("GET /api/drivers with admin token", True,
                                    f"Retrieved {len(data)} drivers successfully")
                    else:
                        self.log_test("GET /api/drivers with admin token", False,
                                    f"Driver structure missing keys: {expected_keys}", first_driver)
                else:
                    self.log_test("GET /api/drivers with admin token", False,
                                "Empty drivers list or invalid format", data)
            else:
                self.log_test("GET /api/drivers with admin token", False,
                            f"HTTP {response.status_code}: {response.text}", response.text)
                
        except Exception as e:
            self.log_test("GET /api/drivers with admin token", False,
                        f"Request failed: {str(e)}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Backend API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Test sequence as specified in review request
        self.test_seed_endpoint()
        self.test_admin_login()
        self.test_driver_login()
        self.test_restaurant_login()
        self.test_zones_endpoint()
        self.test_drivers_endpoint()
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print()
        
        if total - passed > 0:
            print("❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
            print()
        
        print("✅ PASSED TESTS:")
        for result in self.test_results:
            if result["success"]:
                print(f"  - {result['test']}")
        
        return passed == total

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)