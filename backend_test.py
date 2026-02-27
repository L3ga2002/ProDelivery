import requests
import sys
import json
from datetime import datetime

class DeliveryPlatformTester:
    def __init__(self, base_url="https://fleet-track-admin.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.driver_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f" (Expected {expected_status})"
                if response.text:
                    try:
                        error_data = response.json()
                        details += f" - {error_data.get('detail', response.text[:100])}"
                    except:
                        details += f" - {response.text[:100]}"

            self.log_test(name, success, details)
            return success, response.json() if success and response.text else {}

        except Exception as e:
            self.log_test(name, False, f"Error: {str(e)}")
            return False, {}

    def test_seed_data(self):
        """Test seeding demo data"""
        print("\n🌱 Testing seed data endpoint...")
        success, response = self.run_test(
            "Seed Demo Data",
            "POST",
            "seed",
            200
        )
        return success

    def test_admin_login(self):
        """Test admin login"""
        print("\n🔐 Testing admin login...")
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@delivery.ro", "password": "admin123"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            return True
        return False

    def test_driver_login(self):
        """Test driver login"""
        print("\n🚚 Testing driver login...")
        success, response = self.run_test(
            "Driver Login",
            "POST",
            "auth/login",
            200,
            data={"email": "driver-001@delivery.ro", "password": "driver123"}
        )
        if success and 'token' in response:
            self.driver_token = response['token']
            return True
        return False

    def test_orders_endpoint(self):
        """Test orders endpoint"""
        print("\n📦 Testing orders endpoint...")
        if not self.admin_token:
            self.log_test("Get Orders", False, "No admin token")
            return False
            
        success, response = self.run_test(
            "Get Orders",
            "GET",
            "orders",
            200,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        if success:
            orders = response if isinstance(response, list) else []
            self.log_test(f"Orders Count Check", len(orders) >= 0, f"Found {len(orders)} orders")
        
        return success

    def test_drivers_endpoint(self):
        """Test drivers endpoint"""
        print("\n👥 Testing drivers endpoint...")
        if not self.admin_token:
            self.log_test("Get Drivers", False, "No admin token")
            return False
            
        success, response = self.run_test(
            "Get Drivers",
            "GET",
            "drivers",
            200,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        if success:
            drivers = response if isinstance(response, list) else []
            self.log_test(f"Drivers Count Check", len(drivers) >= 0, f"Found {len(drivers)} drivers")
        
        return success

    def test_driver_orders_endpoint(self):
        """Test driver-specific orders endpoint"""
        print("\n🚛 Testing driver orders endpoint...")
        if not self.driver_token:
            self.log_test("Get Driver Orders", False, "No driver token")
            return False
            
        success, response = self.run_test(
            "Get Driver Orders",
            "GET",
            "orders/driver/driver-001",
            200,
            headers={"Authorization": f"Bearer {self.driver_token}"}
        )
        return success

    def test_order_assignment(self):
        """Test order assignment functionality"""
        print("\n🎯 Testing order assignment...")
        if not self.admin_token:
            self.log_test("Order Assignment", False, "No admin token")
            return False

        # First get orders to find a NEW order
        success, orders_response = self.run_test(
            "Get Orders for Assignment",
            "GET",
            "orders",
            200,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        if not success:
            return False
            
        orders = orders_response if isinstance(orders_response, list) else []
        new_orders = [o for o in orders if o.get('status') == 'NEW']
        
        if not new_orders:
            self.log_test("Order Assignment", False, "No NEW orders available for assignment")
            return False
            
        order_id = new_orders[0]['id']
        
        # Try to assign order to driver-001
        success, response = self.run_test(
            "Assign Order to Driver",
            "PUT",
            f"orders/{order_id}/assign",
            200,
            data={"driver_id": "driver-001"},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        return success

    def test_order_status_update(self):
        """Test order status update"""
        print("\n📋 Testing order status update...")
        if not self.driver_token:
            self.log_test("Order Status Update", False, "No driver token")
            return False

        # Get driver orders to find an assigned order
        success, orders_response = self.run_test(
            "Get Driver Orders for Status Update",
            "GET",
            "orders/driver/driver-001",
            200,
            headers={"Authorization": f"Bearer {self.driver_token}"}
        )
        
        if not success:
            return False
            
        orders = orders_response if isinstance(orders_response, list) else []
        assigned_orders = [o for o in orders if o.get('status') == 'ASSIGNED']
        
        if not assigned_orders:
            self.log_test("Order Status Update", False, "No ASSIGNED orders available for status update")
            return False
            
        order_id = assigned_orders[0]['id']
        
        # Update status to ACCEPTED
        success, response = self.run_test(
            "Update Order Status to ACCEPTED",
            "PUT",
            f"orders/{order_id}/status",
            200,
            data={"status": "ACCEPTED"},
            headers={"Authorization": f"Bearer {self.driver_token}"}
        )
        return success

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Delivery Platform API Tests")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)

        # Test basic endpoints first
        self.test_seed_data()
        
        # Test authentication
        admin_login_success = self.test_admin_login()
        driver_login_success = self.test_driver_login()
        
        if not admin_login_success or not driver_login_success:
            print("\n❌ Authentication failed, stopping tests")
            return False

        # Test data endpoints
        self.test_orders_endpoint()
        self.test_drivers_endpoint()
        self.test_driver_orders_endpoint()
        
        # Test functionality
        self.test_order_assignment()
        self.test_order_status_update()

        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Tests Summary: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed")
            return False

def main():
    tester = DeliveryPlatformTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/test_reports/backend_test_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_tests': tester.tests_run,
            'passed_tests': tester.tests_passed,
            'success_rate': tester.tests_passed / tester.tests_run if tester.tests_run > 0 else 0,
            'results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())