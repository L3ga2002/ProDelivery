import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useTheme } from "../context/ThemeContext";
import { toast } from "sonner";
import { Truck, Lock, Mail, Download, Moon, Sun } from "lucide-react";

const DEMO_CREDENTIALS = {
  admin: {
    email: process.env.REACT_APP_DEMO_ADMIN_EMAIL,
    password: process.env.REACT_APP_DEMO_ADMIN_PASSWORD,
  },
  driver: {
    email: process.env.REACT_APP_DEMO_DRIVER_1_EMAIL,
    password: process.env.REACT_APP_DEMO_DRIVER_PASSWORD,
  },
  restaurant: {
    email: process.env.REACT_APP_DEMO_RESTAURANT_1_EMAIL,
    password: process.env.REACT_APP_DEMO_RESTAURANT_PASSWORD,
  },
};

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
  const { theme, isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const hasDemoCredentials = Object.values(DEMO_CREDENTIALS).every(
    (account) => account.email && account.password,
  );

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
    const demoAccount = DEMO_CREDENTIALS[role];

    if (!demoAccount?.email || !demoAccount?.password) {
      toast.error("Credențialele demo nu sunt configurate.");
      setIsLoading(false);
      return;
    }

    const result = await login(demoAccount.email, demoAccount.password);
    
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

  const loginBackground =
    theme === "dark"
      ? "linear-gradient(135deg, hsl(215 75% 10% / 0.96), hsl(220 30% 6% / 0.92)), url('https://images.unsplash.com/photo-1526367790999-0150786686a2?w=1920&q=80')"
      : "linear-gradient(135deg, hsl(215 75% 92% / 0.86), hsl(24 95% 88% / 0.76)), url('https://images.unsplash.com/photo-1526367790999-0150786686a2?w=1920&q=80')";

  return (
    <div 
      className="relative min-h-screen flex items-center justify-center overflow-hidden p-4 bg-cover bg-center"
      style={{
        backgroundImage: loginBackground,
      }}
    >
      <div className="absolute right-4 top-4 z-10">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          className="border-border/80 bg-card/85 backdrop-blur"
          data-testid="login-theme-toggle"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">Tema: {isDark ? "Dark" : "Light"}</span>
        </Button>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_30%)] dark:bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_30%)]" />

      <Card className="relative z-10 w-full max-w-md border border-white/15 bg-card/92 shadow-2xl backdrop-blur-md" data-testid="login-card">
        <CardHeader className="space-y-4 text-center pb-2">
          <div className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, hsl(215 75% 22%), hsl(215 75% 30%))' }}>
            <Truck className="w-10 h-10 text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>
              PRODELIVERY
            </CardTitle>
            <p className="text-sm font-semibold tracking-widest mt-0.5" style={{ color: 'hsl(24 95% 53%)' }}>BACAU</p>
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

          {hasDemoCredentials && (
            <p className="text-xs text-center text-muted-foreground">
              Admin: {DEMO_CREDENTIALS.admin.email} / {DEMO_CREDENTIALS.admin.password}<br />
              Livrator: {DEMO_CREDENTIALS.driver.email} / {DEMO_CREDENTIALS.driver.password}<br />
              Restaurant: {DEMO_CREDENTIALS.restaurant.email} / {DEMO_CREDENTIALS.restaurant.password}
            </p>
          )}

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

          <div className="text-xs text-center text-muted-foreground p-3 bg-muted/60 rounded-lg">
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
