import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

// Leaflet types
declare global {
  interface Window {
    L: any;
  }
}

const SiteTimeMachine = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get coordinates from URL params or use defaults
  const initialLat = parseFloat(searchParams.get("lat") || "35.824");
  const initialLon = parseFloat(searchParams.get("lon") || "-81.733");
  const siteName = searchParams.get("name") || "Location";
  const siteId = searchParams.get("siteId");

  const [latitude, setLatitude] = useState(initialLat.toString());
  const [longitude, setLongitude] = useState(initialLon.toString());
  const [month, setMonth] = useState("06");
  const [year, setYear] = useState(2020);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<any>(null);

  // Load Leaflet scripts
  useEffect(() => {
    const loadScripts = async () => {
      // Check if already loaded
      if (window.L) {
        setMapLoaded(true);
        setLoading(false);
        return;
      }

      // Load CSS
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.3/dist/leaflet.css";
      document.head.appendChild(link);

      // Load Leaflet
      const leafletScript = document.createElement("script");
      leafletScript.src = "https://unpkg.com/leaflet@1.9.3/dist/leaflet.js";
      leafletScript.async = true;

      leafletScript.onload = () => {
        // Load proj4
        const proj4Script = document.createElement("script");
        proj4Script.src = "https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.js";
        proj4Script.async = true;

        proj4Script.onload = () => {
          // Load proj4leaflet
          const proj4leafletScript = document.createElement("script");
          proj4leafletScript.src = "https://cdnjs.cloudflare.com/ajax/libs/proj4leaflet/1.0.2/proj4leaflet.js";
          proj4leafletScript.async = true;

          proj4leafletScript.onload = () => {
            setMapLoaded(true);
            setLoading(false);
          };

          document.head.appendChild(proj4leafletScript);
        };

        document.head.appendChild(proj4Script);
      };

      document.head.appendChild(leafletScript);
    };

    loadScripts();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || mapRef.current) return;

    const L = window.L;

    // EPSG:4326 CRS for NASA GIBS
    const res = [0.5625, 0.28125, 0.140625, 0.0703125, 0.03515625, 0.017578125, 0.0087890625, 0.00439453125, 0.002197265625];
    const EPSG4326 = new L.Proj.CRS(
      "EPSG:4326",
      "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs",
      {
        origin: [-180, 90],
        resolutions: res,
        bounds: L.bounds([[-180, -90], [180, 90]])
      }
    );

    // Create map
    mapRef.current = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 8,
      minZoom: 3,
      maxZoom: 9,
      crs: EPSG4326
    });

    // Initial tile load
    updateTileLayer();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapLoaded]);

  // Update tile layer when year or month changes
  const updateTileLayer = () => {
    if (!mapRef.current || !window.L) return;

    const L = window.L;
    const day = "15";
    const dateString = `${year}-${month}-${day}`;

    // Remove existing tile layer
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    // Add new tile layer
    tileLayerRef.current = L.tileLayer(
      "https://gibs-{s}.earthdata.nasa.gov/wmts/epsg4326/best/{layer}/default/{time}/{tileMatrixSet}/{z}/{y}/{x}.jpg",
      {
        layer: "MODIS_Terra_CorrectedReflectance_TrueColor",
        tileMatrixSet: "250m",
        time: dateString,
        tileSize: 512,
        subdomains: "abc",
        noWrap: true,
        maxNativeZoom: 8,
        attribution: "NASA GIBS"
      }
    ).addTo(mapRef.current);
  };

  // Update tiles when year/month changes
  useEffect(() => {
    if (mapRef.current) {
      updateTileLayer();
    }
  }, [year, month]);

  const handleGoToLocation = () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      mapRef.current?.setView([lat, lon], 8);
    }
  };

  const handleBack = () => {
    if (siteId) {
      navigate(`/site/${siteId}`);
    } else {
      navigate(-1);
    }
  };

  const currentYear = new Date().getFullYear();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading satellite imagery...</p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveLayout>
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 lg:px-8 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="hover:bg-muted h-10 w-10"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <PageHeader showLogo={false} />
            </div>
            <AccountButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative h-[calc(100vh-73px)]">
        {/* Map Container */}
        <div ref={mapContainerRef} className="absolute inset-0 z-0" />

        {/* Controls Panel */}
        <Card className="absolute bottom-4 left-4 z-10 w-80 bg-background/95 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-xl">🛰️</span>
              {siteName} - Time Machine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Coordinates */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Coordinates</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="Latitude"
                  className="text-center"
                />
                <Input
                  type="text"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="Longitude"
                  className="text-center"
                />
              </div>
            </div>

            {/* Month Selection */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Best Viewing Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="01">January</SelectItem>
                  <SelectItem value="02">February</SelectItem>
                  <SelectItem value="03">March</SelectItem>
                  <SelectItem value="04">April</SelectItem>
                  <SelectItem value="05">May</SelectItem>
                  <SelectItem value="06">June</SelectItem>
                  <SelectItem value="07">July</SelectItem>
                  <SelectItem value="08">August</SelectItem>
                  <SelectItem value="09">September</SelectItem>
                  <SelectItem value="10">October</SelectItem>
                  <SelectItem value="11">November</SelectItem>
                  <SelectItem value="12">December</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Go Button */}
            <Button onClick={handleGoToLocation} className="w-full">
              Jump to Location
            </Button>

            {/* Year Slider */}
            <div className="space-y-2 pt-2 border-t">
              <div className="text-center">
                <span className="text-3xl font-bold text-primary">{year}</span>
              </div>
              <Slider
                value={[year]}
                onValueChange={(value) => setYear(value[0])}
                min={2000}
                max={currentYear}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-center text-muted-foreground">
                Drag slider to change year
              </p>
            </div>

            {/* Attribution */}
            <p className="text-xs text-center text-muted-foreground pt-2 border-t">
              Satellite imagery from NASA GIBS
            </p>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  );
};

export default SiteTimeMachine;
