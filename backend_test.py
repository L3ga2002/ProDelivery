#!/usr/bin/env python3
"""
Backend Auth Testing for httpOnly Cookie Migration
Tests the auth flows after migration to httpOnly cookies on preview environment.
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Test configuration
BASE_URL = "https://driver-ranking-1.preview.emergentagent.com/api"

# Test credentials from environment
TEST_CREDENTIALS = {
    "admin": {
        "email": "admin@delivery.ro",
        "password": "admin123"
    },
    "driver": {
        "email": "driver-001@delivery.ro", 
        "password": "driver123"
    },
    "restaurant": {
        "email": "rest-001@delivery.ro",
        "password": "restaurant123"
    }
}

class AuthTester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        
    def test_login(self, user_type: str) -> Dict[str, Any]:
        """Test login endpoint and verify cookie setting"""
        print(f"\n=== Testing {user_type.upper()} Login ===")
        
        credentials = TEST_CREDENTIALS[user_type]
        url = f"{BASE_URL}/auth/login"
        
        try:
            response = self.session.post(url, json=credentials)
            print(f"POST {url}")
            print(f"Request: {json.dumps(credentials, indent=2)}")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
                
                # Check cookies
                cookies = response.cookies
                print(f"Cookies received: {dict(cookies)}")
                
                # Verify httpOnly cookies are set
                access_token_cookie = cookies.get('access_token')
                refresh_token_cookie = cookies.get('refresh_token')
                
                if access_token_cookie and refresh_token_cookie:
                    print("✅ Both access_token and refresh_token cookies set")
                    
                    # Verify response still includes token for compatibility
                    if 'token' in data and 'user' in data:
                        print("✅ Response includes token and user for compatibility")
                        return {
                            "success": True,
                            "user": data['user'],
                            "token": data['token'],
                            "cookies": dict(cookies)
                        }
                    else:
                        print("❌ Response missing token or user fields")
                        return {"success": False, "error": "Missing token or user in response"}
                else:
                    print("❌ Missing auth cookies")
                    return {"success": False, "error": "Auth cookies not set"}
            else:
                print(f"❌ Login failed: {response.text}")
                return {"success": False, "error": f"Status {response.status_code}: {response.text}"}
                
        except Exception as e:
            print(f"❌ Login error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def test_me_with_cookies(self) -> Dict[str, Any]:
        """Test /me endpoint using cookies from login"""
        print(f"\n=== Testing GET /auth/me with Cookies ===")
        
        url = f"{BASE_URL}/auth/me"
        
        try:
            # Use session cookies from login
            response = self.session.get(url)
            print(f"GET {url}")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
                print("✅ /auth/me works with cookies")
                return {"success": True, "user": data}
            else:
                print(f"❌ /auth/me failed: {response.text}")
                return {"success": False, "error": f"Status {response.status_code}: {response.text}"}
                
        except Exception as e:
            print(f"❌ /auth/me error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def test_refresh_token(self) -> Dict[str, Any]:
        """Test refresh token endpoint"""
        print(f"\n=== Testing POST /auth/refresh ===")
        
        url = f"{BASE_URL}/auth/refresh"
        
        try:
            # Use session cookies from login
            response = self.session.post(url)
            print(f"POST {url}")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
                
                # Check if new access_token cookie is set
                cookies = response.cookies
                print(f"New cookies: {dict(cookies)}")
                
                if cookies.get('access_token'):
                    print("✅ Refresh token works and sets new access_token")
                    return {"success": True, "token": data.get('token')}
                else:
                    print("❌ Refresh didn't set new access_token cookie")
                    return {"success": False, "error": "No new access_token cookie"}
            else:
                print(f"❌ Refresh failed: {response.text}")
                return {"success": False, "error": f"Status {response.status_code}: {response.text}"}
                
        except Exception as e:
            print(f"❌ Refresh error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def test_logout(self) -> Dict[str, Any]:
        """Test logout endpoint"""
        print(f"\n=== Testing POST /auth/logout ===")
        
        url = f"{BASE_URL}/auth/logout"
        
        try:
            response = self.session.post(url)
            print(f"POST {url}")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
                print("✅ Logout successful")
                return {"success": True, "message": data.get('message')}
            else:
                print(f"❌ Logout failed: {response.text}")
                return {"success": False, "error": f"Status {response.status_code}: {response.text}"}
                
        except Exception as e:
            print(f"❌ Logout error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def test_me_after_logout(self) -> Dict[str, Any]:
        """Test /me endpoint after logout to verify cookies are cleared"""
        print(f"\n=== Testing GET /auth/me After Logout ===")
        
        url = f"{BASE_URL}/auth/me"
        
        try:
            response = self.session.get(url)
            print(f"GET {url}")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 401:
                print("✅ /auth/me correctly returns 401 after logout")
                return {"success": True, "message": "Correctly unauthenticated"}
            else:
                print(f"❌ /auth/me should return 401 after logout, got {response.status_code}")
                return {"success": False, "error": f"Expected 401, got {response.status_code}"}
                
        except Exception as e:
            print(f"❌ /auth/me after logout error: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def test_bearer_token_fallback(self, token: str) -> Dict[str, Any]:
        """Test that Authorization Bearer fallback still works"""
        print(f"\n=== Testing Authorization Bearer Fallback ===")
        
        # Create new session without cookies
        test_session = requests.Session()
        test_session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f'Bearer {token}'
        })
        
        url = f"{BASE_URL}/auth/me"
        
        try:
            response = test_session.get(url)
            print(f"GET {url}")
            print(f"Authorization: Bearer {token[:20]}...")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
                print("✅ Authorization Bearer fallback works")
                return {"success": True, "user": data}
            else:
                print(f"❌ Bearer fallback failed: {response.text}")
                return {"success": False, "error": f"Status {response.status_code}: {response.text}"}
                
        except Exception as e:
            print(f"❌ Bearer fallback error: {str(e)}")
            return {"success": False, "error": str(e)}

def main():
    """Run comprehensive auth testing"""
    print("🔐 Starting Auth Testing for httpOnly Cookie Migration")
    print(f"Base URL: {BASE_URL}")
    
    tester = AuthTester()
    results = {}
    
    # Test 1: Admin Login
    admin_result = tester.test_login("admin")
    results["admin_login"] = admin_result
    
    if admin_result["success"]:
        admin_token = admin_result["token"]
        
        # Test 2: /me with cookies
        me_result = tester.test_me_with_cookies()
        results["me_with_cookies"] = me_result
        
        # Test 3: Refresh token
        refresh_result = tester.test_refresh_token()
        results["refresh_token"] = refresh_result
        
        # Test 4: Logout
        logout_result = tester.test_logout()
        results["logout"] = logout_result
        
        # Test 5: /me after logout
        me_after_logout = tester.test_me_after_logout()
        results["me_after_logout"] = me_after_logout
        
        # Test 6: Bearer token fallback
        bearer_result = tester.test_bearer_token_fallback(admin_token)
        results["bearer_fallback"] = bearer_result
    
    # Test 7: Driver login regression test
    driver_result = tester.test_login("driver")
    results["driver_login"] = driver_result
    
    # Test 8: Restaurant login regression test  
    restaurant_result = tester.test_login("restaurant")
    results["restaurant_login"] = restaurant_result
    
    # Summary
    print(f"\n{'='*60}")
    print("🔐 AUTH TESTING SUMMARY")
    print(f"{'='*60}")
    
    passed = 0
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result["success"] else "❌ FAIL"
        print(f"{test_name:25} {status}")
        if result["success"]:
            passed += 1
        else:
            print(f"  Error: {result.get('error', 'Unknown error')}")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All auth tests passed! httpOnly cookie migration successful.")
        return 0
    else:
        print("⚠️  Some auth tests failed. Check implementation.")
        return 1

if __name__ == "__main__":
    sys.exit(main())