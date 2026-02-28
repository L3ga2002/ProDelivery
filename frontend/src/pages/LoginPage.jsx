import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { toast } from "sonner";
import { Truck, Lock, Mail, Download } from "lucide-react";

// PWA Install prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Check if PWA can be installed
  useEffect(() => {
    const checkInstall = () => {
      setCanInstall(!!deferredPrompt);
    };
    checkInstall();
    window.addEventListener('beforeinstallprompt', checkInstall);
    return () => window.removeEventListener('beforeinstallprompt', checkInstall);
  }, []);

  const installPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success('Aplicație instalată cu succes!');
      setCanInstall(false);
    }
    deferredPrompt = null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(email, password);

    if (result.success) {
      toast.success(`Bine ai venit, ${result.user.name}!`);
      if (result.user.role === "admin") {
        navigate("/admin");
      } else if (result.user.role === "driver") {
        navigate("/driver");
      }
    } else {
      toast.error(result.error);
    }

    setIsLoading(false);
  };

  const handleDemoLogin = async (role) => {
    setIsLoading(true);
    let demoEmail, demoPassword;
    
    if (role === "admin") {
      demoEmail = "admin@delivery.ro";
      demoPassword = "admin123";
    } else if (role === "restaurant") {
      demoEmail = "rest-001@delivery.ro";
      demoPassword = "restaurant123";
    } else {
      demoEmail = "driver-001@delivery.ro";
      demoPassword = "driver123";
    }

    const result = await login(demoEmail, demoPassword);
    
    if (result.success) {
      toast.success(`Bine ai venit, ${result.user.name}!`);
      if (result.user.role === "admin") {
        navigate("/admin");
      } else if (result.user.role === "restaurant") {
        navigate("/restaurant");
      } else {
        navigate("/driver");
      }
    } else {
      toast.error(result.error);
    }
    
    setIsLoading(false);
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center"
      style={{
        backgroundImage: "linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.7)), url('https://images.unsplash.com/photo-1758384077159-29cad24750d8?crop=entropy&cs=srgb&fm=jpg&q=85')"
      }}
    >
      <Card className="w-full max-w-md shadow-2xl border-0" data-testid="login-card">
        <CardHeader className="space-y-4 text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
            <Truck className="w-9 h-9 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              PRODELIVERY
            </CardTitle>
            <CardDescription className="text-base mt-1">
              Platformă de management livrări
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplu.ro"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11"
                  required
                  data-testid="email-input"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Parolă</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11"
                  required
                  data-testid="password-input"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold"
              disabled={isLoading}
              data-testid="login-button"
            >
              {isLoading ? "Se conectează..." : "Autentificare"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">sau acces demo</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              onClick={() => handleDemoLogin("admin")}
              disabled={isLoading}
              className="h-11"
              data-testid="demo-admin-button"
            >
              Demo Admin
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDemoLogin("driver")}
              disabled={isLoading}
              className="h-11"
              data-testid="demo-driver-button"
            >
              Demo Livrator
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDemoLogin("restaurant")}
              disabled={isLoading}
              className="h-11"
              data-testid="demo-restaurant-button"
            >
              Demo Restaurant
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Admin: admin@delivery.ro / admin123<br />
            Livrator: driver-001@delivery.ro / driver123<br />
            Restaurant: rest-001@delivery.ro / restaurant123
          </p>

          {canInstall && (
            <Button
              variant="outline"
              onClick={installPWA}
              className="w-full h-11"
              data-testid="install-pwa-button"
            >
              <Download className="w-4 h-4 mr-2" />
              Instalează Aplicația
            </Button>
          )}

          <div className="text-xs text-center text-muted-foreground p-3 bg-muted/50 rounded-lg">
            <p className="font-medium mb-1">📱 Instalare pe telefon:</p>
            <p>Android: Menu Chrome → "Adaugă pe ecranul principal"</p>
            <p>iPhone: Safari → Share → "Add to Home Screen"</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
