import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, Circle, Popup, LayersControl, useMap } from 'react-leaflet';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart } from 'recharts';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Algorithme de classification de Jenks (Natural Breaks)
const getJenksBreaks = (values, numClasses) => {
  if (!values || values.length === 0) return [];
  
  const data = values.filter(v => v > 0).sort((a, b) => a - b);
  if (data.length === 0) return [];
  if (data.length <= numClasses) {
    return [...new Set(data)].sort((a, b) => a - b);
  }

  const matrices = {
    lower: [],
    variance: []
  };

  for (let i = 0; i < data.length + 1; i++) {
    matrices.lower[i] = [];
    matrices.variance[i] = [];
    for (let j = 0; j < numClasses + 1; j++) {
      matrices.lower[i][j] = 0;
      matrices.variance[i][j] = 0;
    }
  }

  for (let i = 1; i < data.length + 1; i++) {
    let sum = 0;
    let sumSquares = 0;
    let variance = 0;

    for (let j = 1; j < i + 1; j++) {
      const val = data[j - 1];
      sum += val;
      sumSquares += val * val;
      variance = sumSquares - (sum * sum) / j;
      
      matrices.lower[i][1] = j;
      matrices.variance[i][1] = variance;

      for (let k = 2; k < numClasses + 1; k++) {
        const s = i - matrices.lower[i][k - 1];
        if (s !== 0) {
          let newSum = 0;
          let newSumSquares = 0;
          
          for (let p = 0; p < s; p++) {
            const idx = i - s + p;
            const val = data[idx];
            newSum += val;
            newSumSquares += val * val;
          }
          
          const newVariance = newSumSquares - (newSum * newSum) / s;
          
          if (matrices.variance[i][k] === 0 || newVariance + matrices.variance[i - s][k - 1] < matrices.variance[i][k]) {
            matrices.lower[i][k] = s;
            matrices.variance[i][k] = newVariance + matrices.variance[i - s][k - 1];
          }
        }
      }
    }
  }

  const breaks = [];
  let k = data.length;
  
  for (let j = numClasses; j >= 1; j--) {
    const id = matrices.lower[k][j];
    breaks.unshift(data[k - id]);
    k -= id;
  }

  breaks.push(data[data.length - 1]);
  
  return breaks;
};

// Composant de légende pour les cartes avec classification de Jenks
const MapLegend = ({ layer, values, title }) => {
  const map = useMap();

  useEffect(() => {
    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'info legend');
      
      const colors = {
        schools: '#dc2626',
        children: '#ea580c',
        idps: '#f59e0b',
        events: '#eab308'
      };
      
      const color = colors[layer] || '#dc2626';
      
      // Calculer les breaks de Jenks avec 5 classes
      const breaks = getJenksBreaks(values, 5);
      
      // Créer les classes avec leurs couleurs
      const classes = [];
      if (breaks.length > 0) {
        for (let i = 0; i < breaks.length - 1; i++) {
          const opacity = 0.3 + (i / (breaks.length - 1)) * 0.6;
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          
          classes.push({
            min: breaks[i],
            max: i < breaks.length - 1 ? breaks[i + 1] : breaks[i],
            color: `rgba(${r}, ${g}, ${b}, ${opacity})`
          });
        }
      }
      
      div.innerHTML = `
        <div style="
          background: rgba(255, 255, 255, 0.95);
          padding: 12px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          font-family: 'Inter', sans-serif;
          min-width: 200px;
        ">
          <div style="
            font-weight: 700;
            margin-bottom: 10px;
            color: #1e293b;
            font-size: 13px;
            border-bottom: 2px solid ${color};
            padding-bottom: 6px;
          ">${title}</div>
          ${classes.map((cls, i) => {
            const isLast = i === classes.length - 1;
            const displayMax = isLast ? Math.round(cls.max) : Math.round(cls.max);
            
            return `
              <div style="
                display: flex;
                align-items: center;
                margin: 5px 0;
                font-size: 11px;
                color: #334155;
              ">
                <span style="
                  width: 24px;
                  height: 18px;
                  background: ${cls.color};
                  border: 1px solid #94a3b8;
                  margin-right: 8px;
                  border-radius: 3px;
                  display: inline-block;
                  flex-shrink: 0;
                "></span>
                <span style="font-weight: 500;">${Math.round(cls.min).toLocaleString()} - ${displayMax.toLocaleString()}</span>
              </div>
            `;
          }).join('')}
          <div style="
            display: flex;
            align-items: center;
            margin: 5px 0;
            font-size: 11px;
            color: #334155;
            padding-top: 6px;
            border-top: 1px solid #e5e7eb;
          ">
            <span style="
              width: 24px;
              height: 18px;
              background: #e5e7eb;
              border: 1px solid #94a3b8;
              margin-right: 8px;
              border-radius: 3px;
              display: inline-block;
              flex-shrink: 0;
            "></span>
            <span style="font-style: italic; color: #64748b;">Pas de données</span>
          </div>
        </div>
      `;
      
      return div;
    };

    legend.addTo(map);

    return () => {
      legend.remove();
    };
  }, [map, layer, values, title]);

  return null;
};

// Fonction pour obtenir la couleur basée sur les breaks de Jenks
const getColorFromBreaks = (value, breaks, baseColor) => {
  if (value === 0 || value === null || value === undefined) {
    return '#e5e7eb';
  }
  
  if (breaks.length === 0) return baseColor;
  
  let classIndex = 0;
  for (let i = 0; i < breaks.length - 1; i++) {
    if (value >= breaks[i] && value <= breaks[i + 1]) {
      classIndex = i;
      break;
    }
  }
  
  const opacity = 0.3 + (classIndex / (breaks.length - 1)) * 0.6;
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const App = () => {
  const [data, setData] = useState([]);
  const [regionsGeo, setRegionsGeo] = useState(null);
  const [provincesGeo, setProvincesGeo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Filtres obligatoires - initialisés avec des valeurs par défaut
  const [filters, setFilters] = useState({
    year: 2022,
    month: 'Decembre',
    region: 'Tous',
    province: 'Tous'
  });
  
  const [mapLayer, setMapLayer] = useState('schools');
  const [animationYear, setAnimationYear] = useState(2018);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [dataRes, regionsRes, provincesRes] = await Promise.all([
          fetch('data.json'),
          fetch('regions.json'),
          fetch('provinces.json')
        ]);
        
        const dataJson = await dataRes.json();
        const regionsJson = await regionsRes.json();
        const provincesJson = await provincesRes.json();
        
        setData(dataJson);
        setRegionsGeo(regionsJson);
        setProvincesGeo(provincesJson);
        setLoading(false);
      } catch (error) {
        console.error('Erreur de chargement:', error);
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  useEffect(() => {
    if (!isAnimating) return;
    const interval = setInterval(() => {
      setAnimationYear(prev => {
        if (prev >= 2022) {
          setIsAnimating(false);
          return 2022;
        }
        return prev + 1;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isAnimating]);

  // Filtrage des données - chaque mois affiche la dernière valeur cumulée disponible
  const filteredData = useMemo(() => {
    if (!data.length) return [];
    
    let filtered = data;
    
    // Filtrage obligatoire par année
    filtered = filtered.filter(d => d.Year === parseInt(filters.year));
    
    // Filtrage obligatoire par mois
    filtered = filtered.filter(d => d.Month === filters.month);
    
    // Filtrage par région (optionnel)
    if (filters.region !== 'Tous') {
      filtered = filtered.filter(d => d.Region === filters.region);
    }
    
    // Filtrage par province (optionnel)
    if (filters.province !== 'Tous') {
      filtered = filtered.filter(d => d.Province === filters.province);
    }
    
    return filtered;
  }, [data, filters]);

  // Années disponibles (sans option "Tous")
  const years = useMemo(() => {
    if (!data.length) return [];
    return Array.from(new Set(data.map(d => d.Year))).sort();
  }, [data]);

  // Mois disponibles (sans option "Tous")
  const months = useMemo(() => {
    if (!data.length) return [];
    return Array.from(new Set(data.map(d => d.Month)));
  }, [data]);

  // Régions disponibles (avec option "Tous")
  const regions = useMemo(() => {
    if (!data.length) return [];
    return ['Tous', ...Array.from(new Set(data.map(d => d.Region))).sort()];
  }, [data]);

  // Provinces disponibles (avec option "Tous")
  const provinces = useMemo(() => {
    if (!data.length) return [];
    let provinceList = ['Tous'];
    
    if (filters.region !== 'Tous') {
      // Si une région est sélectionnée, afficher uniquement les provinces de cette région
      const filteredProvinces = Array.from(new Set(
        data.filter(d => d.Region === filters.region).map(d => d.Province)
      )).sort();
      provinceList = ['Tous', ...filteredProvinces];
    } else {
      // Sinon, afficher toutes les provinces
      provinceList = ['Tous', ...Array.from(new Set(data.map(d => d.Province))).sort()];
    }
    
    return provinceList;
  }, [data, filters.region]);

  // KPIs - calculés sur les données filtrées (un seul mois)
  const kpis = useMemo(() => {
    if (!filteredData.length) return {};
    
    const totalSchools = filteredData.reduce((sum, d) => sum + (d.NbTotalSchool || 0), 0);
    const closedSchools = filteredData.reduce((sum, d) => sum + (d.SchoolClosed || 0), 0);
    const childrenAffected = filteredData.reduce((sum, d) => sum + (d.ChildrenAffected || 0), 0);
    const teachersAffected = filteredData.reduce((sum, d) => sum + (d.TeacherAffected || 0), 0);
    const idps = filteredData.reduce((sum, d) => sum + (d.IDPs || 0), 0);
    const idpsSchoolAge = filteredData.reduce((sum, d) => sum + (d.IDPs_SchoolAge || 0), 0);
    const events = filteredData.reduce((sum, d) => sum + (d.NbEvents || 0), 0);
    const schoolReopened = filteredData.reduce((sum, d) => sum + (d.SchoolReopened || 0), 0);
    
    const closureRate = totalSchools > 0 ? (closedSchools / totalSchools * 100) : 0;
    const reopeningRate = closedSchools > 0 ? (schoolReopened / closedSchools * 100) : 0;
    
    return {
      totalSchools,
      closedSchools,
      closureRate,
      childrenAffected,
      teachersAffected,
      idps,
      idpsSchoolAge,
      events,
      reopeningRate
    };
  }, [filteredData]);

  // Données chronologiques - pour chaque mois, afficher la dernière valeur cumulée
  const timeSeriesData = useMemo(() => {
    if (!data.length) return [];
    
    const grouped = {};
    data.forEach(d => {
      const key = `${d.Year}-${d.Month}`;
      if (!grouped[key]) {
        grouped[key] = {
          period: `${d.Month} ${d.Year}`,
          year: d.Year,
          month: d.Month,
          closedSchools: 0,
          childrenAffected: 0,
          idps: 0,
          events: 0
        };
      }
      grouped[key].closedSchools += d.SchoolClosed || 0;
      grouped[key].childrenAffected += d.ChildrenAffected || 0;
      grouped[key].idps += d.IDPs || 0;
      grouped[key].events += d.NbEvents || 0;
    });
    
    return Object.values(grouped).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      const months = ['Janvier', 'Avril', 'Aout', 'Decembre'];
      return months.indexOf(a.month) - months.indexOf(b.month);
    });
  }, [data]);

  // Comparaison régionale - basée sur les données filtrées
  const regionalComparison = useMemo(() => {
    if (!filteredData.length) return [];
    
    const grouped = {};
    filteredData.forEach(d => {
      if (!grouped[d.Region]) {
        grouped[d.Region] = {
          region: d.Region,
          totalSchools: 0,
          closedSchools: 0,
          childrenAffected: 0,
          idps: 0,
          events: 0
        };
      }
      grouped[d.Region].totalSchools += d.NbTotalSchool || 0;
      grouped[d.Region].closedSchools += d.SchoolClosed || 0;
      grouped[d.Region].childrenAffected += d.ChildrenAffected || 0;
      grouped[d.Region].idps += d.IDPs || 0;
      grouped[d.Region].events += d.NbEvents || 0;
    });
    
    return Object.values(grouped).map(r => ({
      ...r,
      closureRate: r.totalSchools > 0 ? (r.closedSchools / r.totalSchools * 100) : 0
    })).sort((a, b) => b.closedSchools - a.closedSchools);
  }, [filteredData]);

  // Comparaison provinciale - basée sur les données filtrées
  const provincialComparison = useMemo(() => {
    if (!filteredData.length) return [];
    
    const grouped = {};
    filteredData.forEach(d => {
      if (!grouped[d.Province]) {
        grouped[d.Province] = {
          province: d.Province,
          region: d.Region,
          totalSchools: 0,
          closedSchools: 0,
          childrenAffected: 0,
          idps: 0,
          events: 0
        };
      }
      grouped[d.Province].totalSchools += d.NbTotalSchool || 0;
      grouped[d.Province].closedSchools += d.SchoolClosed || 0;
      grouped[d.Province].childrenAffected += d.ChildrenAffected || 0;
      grouped[d.Province].idps += d.IDPs || 0;
      grouped[d.Province].events += d.NbEvents || 0;
    });
    
    return Object.values(grouped).map(p => ({
      ...p,
      closureRate: p.totalSchools > 0 ? (p.closedSchools / p.totalSchools * 100) : 0
    })).sort((a, b) => b.closedSchools - a.closedSchools);
  }, [filteredData]);

  // Données de corrélation
  const correlationData = useMemo(() => {
    if (!filteredData.length) return [];
    
    return filteredData.map(d => ({
      events: d.NbEvents || 0,
      closedSchools: d.SchoolClosed || 0,
      childrenAffected: d.ChildrenAffected || 0,
      idps: d.IDPs || 0,
      region: d.Region
    })).filter(d => d.events > 0 || d.closedSchools > 0);
  }, [filteredData]);

  // Calculer les breaks de Jenks pour les cartes des régions
  const regionalBreaks = useMemo(() => {
    if (!regionalComparison.length) return { schools: [], children: [], idps: [], events: [] };
    
    return {
      schools: getJenksBreaks(regionalComparison.map(r => r.closedSchools), 5),
      children: getJenksBreaks(regionalComparison.map(r => r.childrenAffected), 5),
      idps: getJenksBreaks(regionalComparison.map(r => r.idps), 5),
      events: getJenksBreaks(regionalComparison.map(r => r.events), 5)
    };
  }, [regionalComparison]);

  // Calculer les breaks de Jenks pour les cartes des provinces
  const provincialBreaks = useMemo(() => {
    if (!provincialComparison.length) return { schools: [], children: [], idps: [], events: [] };
    
    return {
      schools: getJenksBreaks(provincialComparison.map(p => p.closedSchools), 5),
      children: getJenksBreaks(provincialComparison.map(p => p.childrenAffected), 5),
      idps: getJenksBreaks(provincialComparison.map(p => p.idps), 5),
      events: getJenksBreaks(provincialComparison.map(p => p.events), 5)
    };
  }, [provincialComparison]);

  // Valeurs pour les légendes
  const regionalValues = useMemo(() => {
    if (!regionalComparison.length) return { schools: [], children: [], idps: [], events: [] };
    
    return {
      schools: regionalComparison.map(r => r.closedSchools),
      children: regionalComparison.map(r => r.childrenAffected),
      idps: regionalComparison.map(r => r.idps),
      events: regionalComparison.map(r => r.events)
    };
  }, [regionalComparison]);

  const provincialValues = useMemo(() => {
    if (!provincialComparison.length) return { schools: [], children: [], idps: [], events: [] };
    
    return {
      schools: provincialComparison.map(p => p.closedSchools),
      children: provincialComparison.map(p => p.childrenAffected),
      idps: provincialComparison.map(p => p.idps),
      events: provincialComparison.map(p => p.events)
    };
  }, [provincialComparison]);

  const regionColors = {
    'Sahel': '#dc2626',
    'Nord': '#ea580c',
    'Centre-Nord': '#f59e0b',
    'Est': '#eab308',
    'Boucle du Mouhoun': '#84cc16',
    'Centre-Est': '#22c55e',
    'Hauts-Bassins': '#10b981',
    'Sud-Ouest': '#14b8a6'
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '2px solid rgba(148, 163, 184, 0.3)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}>
          {label && <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#f1f5f9' }}>{label}</p>}
          {payload.map((entry, index) => (
            <p key={index} style={{ margin: '4px 0', color: entry.color, fontSize: '13px' }}>
              {entry.name}: <span style={{ fontWeight: '600' }}>{entry.value.toLocaleString()}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const MapUpdater = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
      map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
  };

  const onEachRegion = (feature, layer) => {
    const regionName = feature.properties.ADM1_FR;
    const regionData = regionalComparison.find(r => r.region === regionName);
    
    if (regionData) {
      layer.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; min-width: 200px;">
          <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 16px; font-weight: 600; border-bottom: 2px solid #dc2626; padding-bottom: 8px;">
            ${regionName}
          </h3>
          <div style="font-size: 13px; color: #475569;">
            <p style="margin: 6px 0;"><strong>Écoles fermées:</strong> ${regionData.closedSchools.toLocaleString()}</p>
            <p style="margin: 6px 0;"><strong>Taux fermeture:</strong> ${regionData.closureRate.toFixed(1)}%</p>
            <p style="margin: 6px 0;"><strong>Enfants affectés:</strong> ${regionData.childrenAffected.toLocaleString()}</p>
            <p style="margin: 6px 0;"><strong>IDPs:</strong> ${regionData.idps.toLocaleString()}</p>
            <p style="margin: 6px 0;"><strong>Incidents:</strong> ${regionData.events.toLocaleString()}</p>
          </div>
        </div>
      `);
    }
  };

  const onEachProvince = (feature, layer) => {
    const provinceName = feature.properties.ADM2_FR;
    const provinceData = provincialComparison.find(p => p.province === provinceName);
    
    if (provinceData) {
      layer.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; min-width: 200px;">
          <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 16px; font-weight: 600; border-bottom: 2px solid #dc2626; padding-bottom: 8px;">
            ${provinceName}
          </h3>
          <p style="margin: 0 0 12px 0; color: #64748b; font-size: 12px; font-style: italic;">
            Région: ${provinceData.region}
          </p>
          <div style="font-size: 13px; color: #475569;">
            <p style="margin: 6px 0;"><strong>Écoles fermées:</strong> ${provinceData.closedSchools.toLocaleString()}</p>
            <p style="margin: 6px 0;"><strong>Taux fermeture:</strong> ${provinceData.closureRate.toFixed(1)}%</p>
            <p style="margin: 6px 0;"><strong>Enfants affectés:</strong> ${provinceData.childrenAffected.toLocaleString()}</p>
            <p style="margin: 6px 0;"><strong>IDPs:</strong> ${provinceData.idps.toLocaleString()}</p>
            <p style="margin: 6px 0;"><strong>Incidents:</strong> ${provinceData.events.toLocaleString()}</p>
          </div>
        </div>
      `);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#f1f5f9',
        fontSize: '24px',
        fontFamily: '"Inter", sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div>Chargement des données...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#f1f5f9',
      fontFamily: '"Inter", sans-serif'
    }}>
      {/* Header */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.95)',
        padding: '24px 32px',
        borderBottom: '2px solid rgba(220, 38, 38, 0.3)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px'
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{
            margin: '0 0 8px 0',
            fontSize: '32px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #dc2626 0%, #ea580c 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontFamily: '"Playfair Display", Georgia, serif'
          }}>
            Tableau de Bord Humanitaire - Burkina Faso
          </h1>
          <p style={{
            margin: '0',
            fontSize: '16px',
            color: '#94a3b8',
            fontFamily: '"Inter", sans-serif'
          }}>
            Analyse géospatiale de la crise éducative et humanitaire | {filters.month} {filters.year}
          </p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px',
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
        }}>
          <img 
            src="Logo_UVCI.png" 
            alt="Logo UVCI" 
            style={{
              height: '60px',
              width: 'auto',
              objectFit: 'contain'
            }}
          />
        </div>
      </header>

      {/* Filtres obligatoires */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.95)',
        padding: '24px 32px',
        borderBottom: '2px solid rgba(148, 163, 184, 0.1)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        alignItems: 'end'
      }}>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#cbd5e1'
          }}>
            Année *
          </label>
          <select
            value={filters.year}
            onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(51, 65, 85, 0.8)',
              border: '2px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#cbd5e1'
          }}>
            Mois *
          </label>
          <select
            value={filters.month}
            onChange={(e) => setFilters({ ...filters, month: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(51, 65, 85, 0.8)',
              border: '2px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {months.map(month => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#cbd5e1'
          }}>
            Région
          </label>
          <select
            value={filters.region}
            onChange={(e) => {
              // Réinitialiser la province quand on change de région
              setFilters({ ...filters, region: e.target.value, province: 'Tous' });
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(51, 65, 85, 0.8)',
              border: '2px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {regions.map(region => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#cbd5e1'
          }}>
            Province
          </label>
          <select
            value={filters.province}
            onChange={(e) => setFilters({ ...filters, province: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(51, 65, 85, 0.8)',
              border: '2px solid rgba(148, 163, 184, 0.3)',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {provinces.map(province => (
              <option key={province} value={province}>{province}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setFilters({ year: 2022, month: 'Decembre', region: 'Tous', province: 'Tous' })}
            style={{
              padding: '10px 20px',
              background: 'rgba(220, 38, 38, 0.8)',
              border: 'none',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            🔄 Réinitialiser
          </button>
        </div>
      </div>

      {/* Navigation tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '16px 32px',
        background: 'rgba(15, 23, 42, 0.8)',
        borderBottom: '2px solid rgba(148, 163, 184, 0.1)'
      }}>
        {['dashboard', 'maps', 'analysis'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px',
              background: activeTab === tab ? 'linear-gradient(135deg, #dc2626 0%, #ea580c 100%)' : 'rgba(51, 65, 85, 0.5)',
              border: activeTab === tab ? '2px solid rgba(220, 38, 38, 0.5)' : '2px solid transparent',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {tab === 'dashboard' && '📊 Tableau de bord'}
            {tab === 'maps' && '🗺️ Cartes'}
            {tab === 'analysis' && '📈 Analyses'}
          </button>
        ))}
      </div>

      {/* Main content */}
      <main style={{ padding: '32px' }}>
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <>
            {/* KPI Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
              marginBottom: '32px'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.2) 0%, rgba(220, 38, 38, 0.05) 100%)',
                borderRadius: '16px',
                padding: '24px',
                border: '2px solid rgba(220, 38, 38, 0.3)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
              }}>
                <div style={{ fontSize: '14px', color: '#fca5a5', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Écoles fermées
                </div>
                <div style={{ fontSize: '42px', fontWeight: '700', color: '#dc2626', fontFamily: '"Playfair Display", Georgia, serif' }}>
                  {kpis.closedSchools?.toLocaleString() || 0}
                </div>
                <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '8px' }}>
                  Taux: {kpis.closureRate?.toFixed(1) || 0}%
                </div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.2) 0%, rgba(234, 88, 12, 0.05) 100%)',
                borderRadius: '16px',
                padding: '24px',
                border: '2px solid rgba(234, 88, 12, 0.3)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
              }}>
                <div style={{ fontSize: '14px', color: '#fdba74', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Enfants affectés
                </div>
                <div style={{ fontSize: '42px', fontWeight: '700', color: '#ea580c', fontFamily: '"Playfair Display", Georgia, serif' }}>
                  {kpis.childrenAffected?.toLocaleString() || 0}
                </div>
                <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '8px' }}>
                  Enseignants: {kpis.teachersAffected?.toLocaleString() || 0}
                </div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.05) 100%)',
                borderRadius: '16px',
                padding: '24px',
                border: '2px solid rgba(245, 158, 11, 0.3)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
              }}>
                <div style={{ fontSize: '14px', color: '#fcd34d', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Personnes déplacées
                </div>
                <div style={{ fontSize: '42px', fontWeight: '700', color: '#f59e0b', fontFamily: '"Playfair Display", Georgia, serif' }}>
                  {kpis.idps?.toLocaleString() || 0}
                </div>
                <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '8px' }}>
                  En âge scolaire: {kpis.idpsSchoolAge?.toLocaleString() || 0}
                </div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(234, 179, 8, 0.05) 100%)',
                borderRadius: '16px',
                padding: '24px',
                border: '2px solid rgba(234, 179, 8, 0.3)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
              }}>
                <div style={{ fontSize: '14px', color: '#fde047', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Incidents sécuritaires
                </div>
                <div style={{ fontSize: '42px', fontWeight: '700', color: '#eab308', fontFamily: '"Playfair Display", Georgia, serif' }}>
                  {kpis.events?.toLocaleString() || 0}
                </div>
                <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '8px' }}>
                  Taux réouverture: {kpis.reopeningRate?.toFixed(1) || 0}%
                </div>
              </div>
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
              <div style={{
                background: 'rgba(30, 41, 59, 0.95)',
                borderRadius: '16px',
                padding: '24px',
                border: '2px solid rgba(148, 163, 184, 0.1)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
              }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600', fontFamily: '"Playfair Display", Georgia, serif' }}>
                  Évolution Temporelle des Fermetures d'Écoles
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={timeSeriesData}>
                    <defs>
                      <linearGradient id="colorSchools" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#dc2626" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#dc2626" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                    <XAxis dataKey="period" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-45} textAnchor="end" height={100} />
                    <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="closedSchools" stroke="#dc2626" fillOpacity={1} fill="url(#colorSchools)" name="Écoles fermées" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div style={{
                background: 'rgba(30, 41, 59, 0.95)',
                borderRadius: '16px',
                padding: '24px',
                border: '2px solid rgba(148, 163, 184, 0.1)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
              }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600', fontFamily: '"Playfair Display", Georgia, serif' }}>
                  Répartition Régionale
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={regionalComparison.slice(0, 8)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ region, closedSchools, percent }) => 
                        `${region.split(' ')[0]} (${(percent * 100).toFixed(0)}%)`
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="closedSchools"
                    >
                      {regionalComparison.slice(0, 8).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={Object.values(regionColors)[index % Object.values(regionColors).length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Regional comparison table */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.95)',
              borderRadius: '16px',
              padding: '24px',
              border: '2px solid rgba(148, 163, 184, 0.1)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600', fontFamily: '"Playfair Display", Georgia, serif' }}>
                Comparaison Régionale Détaillée
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={regionalComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis dataKey="region" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-45} textAnchor="end" height={120} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: '13px' }} />
                  <Bar dataKey="closedSchools" fill="#dc2626" name="Écoles fermées" />
                  <Bar dataKey="childrenAffected" fill="#ea580c" name="Enfants affectés (÷100)" />
                  <Bar dataKey="events" fill="#eab308" name="Incidents" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* Maps Tab */}
        {activeTab === 'maps' && (
          <div style={{ display: 'grid', gap: '24px' }}>
            <div style={{
              background: 'rgba(30, 41, 59, 0.95)',
              borderRadius: '16px',
              padding: '24px',
              border: '2px solid rgba(148, 163, 184, 0.1)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
            }}>
              <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => setMapLayer('schools')}
                  style={{
                    padding: '10px 20px',
                    background: mapLayer === 'schools' ? 'linear-gradient(135deg, #dc2626 0%, #ea580c 100%)' : 'rgba(51, 65, 85, 0.8)',
                    border: '2px solid rgba(148, 163, 184, 0.3)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  🏫 Écoles fermées
                </button>
                <button
                  onClick={() => setMapLayer('children')}
                  style={{
                    padding: '10px 20px',
                    background: mapLayer === 'children' ? 'linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)' : 'rgba(51, 65, 85, 0.8)',
                    border: '2px solid rgba(148, 163, 184, 0.3)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  👨‍👩‍👧‍👦 Enfants affectés
                </button>
                <button
                  onClick={() => setMapLayer('idps')}
                  style={{
                    padding: '10px 20px',
                    background: mapLayer === 'idps' ? 'linear-gradient(135deg, #f59e0b 0%, #eab308 100%)' : 'rgba(51, 65, 85, 0.8)',
                    border: '2px solid rgba(148, 163, 184, 0.3)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  🏃 Déplacés internes
                </button>
                <button
                  onClick={() => setMapLayer('events')}
                  style={{
                    padding: '10px 20px',
                    background: mapLayer === 'events' ? 'linear-gradient(135deg, #eab308 0%, #84cc16 100%)' : 'rgba(51, 65, 85, 0.8)',
                    border: '2px solid rgba(148, 163, 184, 0.3)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  ⚠️ Incidents
                </button>
              </div>

              <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600', fontFamily: '"Playfair Display", Georgia, serif', textAlign: 'center' }}>
                Carte des Régions - {
                  mapLayer === 'schools' ? 'Écoles fermées' :
                  mapLayer === 'children' ? 'Enfants affectés' :
                  mapLayer === 'idps' ? 'Personnes déplacées' :
                  'Incidents sécuritaires'
                }
              </h3>

              {regionsGeo && (
                <MapContainer
                  center={[12.3, -1.5]}
                  zoom={6}
                  style={{ height: '500px', width: '100%', borderRadius: '12px' }}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                  />
                  <GeoJSON
                    data={regionsGeo}
                    style={(feature) => {
                      const regionName = feature.properties.ADM1_FR;
                      const regionData = regionalComparison.find(r => r.region === regionName);
                      
                      let value = 0;
                      let breaks = [];
                      let baseColor = '#dc2626';
                      
                      if (mapLayer === 'schools') {
                        value = regionData?.closedSchools || 0;
                        breaks = regionalBreaks.schools;
                        baseColor = '#dc2626';
                      } else if (mapLayer === 'children') {
                        value = regionData?.childrenAffected || 0;
                        breaks = regionalBreaks.children;
                        baseColor = '#ea580c';
                      } else if (mapLayer === 'idps') {
                        value = regionData?.idps || 0;
                        breaks = regionalBreaks.idps;
                        baseColor = '#f59e0b';
                      } else if (mapLayer === 'events') {
                        value = regionData?.events || 0;
                        breaks = regionalBreaks.events;
                        baseColor = '#eab308';
                      }
                      
                      const fillColor = getColorFromBreaks(value, breaks, baseColor);
                      
                      return {
                        fillColor: fillColor,
                        weight: 1.5,
                        opacity: 1,
                        color: '#1f2937',
                        fillOpacity: 0.8
                      };
                    }}
                    onEachFeature={onEachRegion}
                  />
                  <MapLegend 
                    layer={mapLayer} 
                    values={regionalValues[mapLayer]}
                    title={
                      mapLayer === 'schools' ? 'Écoles fermées' :
                      mapLayer === 'children' ? 'Enfants affectés' :
                      mapLayer === 'idps' ? 'Personnes déplacées internes' :
                      'Incidents sécuritaires'
                    }
                  />
                </MapContainer>
              )}
            </div>

            <div style={{
              background: 'rgba(30, 41, 59, 0.95)',
              borderRadius: '16px',
              padding: '24px',
              border: '2px solid rgba(148, 163, 184, 0.1)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600', fontFamily: '"Playfair Display", Georgia, serif', textAlign: 'center' }}>
                Carte des Provinces - {
                  mapLayer === 'schools' ? 'Écoles fermées' :
                  mapLayer === 'children' ? 'Enfants affectés' :
                  mapLayer === 'idps' ? 'Personnes déplacées' :
                  'Incidents sécuritaires'
                }
              </h3>

              {provincesGeo && (
                <MapContainer
                  center={[12.3, -1.5]}
                  zoom={6}
                  style={{ height: '500px', width: '100%', borderRadius: '12px' }}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                  />
                  <GeoJSON
                    data={provincesGeo}
                    style={(feature) => {
                      const provinceName = feature.properties.ADM2_FR;
                      const provinceData = provincialComparison.find(p => p.province === provinceName);
                      
                      let value = 0;
                      let breaks = [];
                      let baseColor = '#dc2626';
                      
                      if (mapLayer === 'schools') {
                        value = provinceData?.closedSchools || 0;
                        breaks = provincialBreaks.schools;
                        baseColor = '#dc2626';
                      } else if (mapLayer === 'children') {
                        value = provinceData?.childrenAffected || 0;
                        breaks = provincialBreaks.children;
                        baseColor = '#ea580c';
                      } else if (mapLayer === 'idps') {
                        value = provinceData?.idps || 0;
                        breaks = provincialBreaks.idps;
                        baseColor = '#f59e0b';
                      } else if (mapLayer === 'events') {
                        value = provinceData?.events || 0;
                        breaks = provincialBreaks.events;
                        baseColor = '#eab308';
                      }
                      
                      const fillColor = getColorFromBreaks(value, breaks, baseColor);
                      
                      return {
                        fillColor: fillColor,
                        weight: 1,
                        opacity: 1,
                        color: '#374151',
                        fillOpacity: 0.8
                      };
                    }}
                    onEachFeature={onEachProvince}
                  />
                  <MapLegend 
                    layer={mapLayer} 
                    values={provincialValues[mapLayer]}
                    title={
                      mapLayer === 'schools' ? 'Écoles fermées' :
                      mapLayer === 'children' ? 'Enfants affectés' :
                      mapLayer === 'idps' ? 'Personnes déplacées internes' :
                      'Incidents sécuritaires'
                    }
                  />
                </MapContainer>
              )}
            </div>
          </div>
        )}

        {/* Analysis Tab */}
        {activeTab === 'analysis' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{
              background: 'rgba(30, 41, 59, 0.95)',
              borderRadius: '16px',
              padding: '24px',
              border: '2px solid rgba(148, 163, 184, 0.1)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600', fontFamily: '"Playfair Display", Georgia, serif' }}>
                Corrélation Incidents / Fermetures
              </h3>
              <ResponsiveContainer width="100%" height={450}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis type="number" dataKey="events" name="Incidents" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} label={{ value: 'Nombre d\'incidents', position: 'bottom', fill: '#94a3b8' }} />
                  <YAxis type="number" dataKey="closedSchools" name="Écoles fermées" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} label={{ value: 'Écoles fermées', angle: -90, position: 'left', fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={correlationData} fill="#dc2626" name="Données" />
                </ScatterChart>
              </ResponsiveContainer>
              <p style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '12px', textAlign: 'center' }}>
                Chaque point représente une observation. Une tendance ascendante indique une corrélation positive.
              </p>
            </div>

            <div style={{
              background: 'rgba(30, 41, 59, 0.95)',
              borderRadius: '16px',
              padding: '24px',
              border: '2px solid rgba(148, 163, 184, 0.1)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600', fontFamily: '"Playfair Display", Georgia, serif' }}>
                Impact Multi-Dimensionnel par Région
              </h3>
              <ResponsiveContainer width="100%" height={450}>
                <RadarChart data={regionalComparison.slice(0, 5).map(r => ({
                  region: r.region,
                  fermetures: r.closureRate,
                  enfants: (r.childrenAffected / 1000),
                  idps: (r.idps / 1000),
                  incidents: r.events / 10
                }))}>
                  <PolarGrid stroke="rgba(148, 163, 184, 0.3)" />
                  <PolarAngleAxis dataKey="region" stroke="#cbd5e1" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <PolarRadiusAxis stroke="#94a3b8" />
                  <Radar name="Taux de fermeture (%)" dataKey="fermetures" stroke="#dc2626" fill="#dc2626" fillOpacity={0.3} />
                  <Radar name="Enfants (milliers)" dataKey="enfants" stroke="#ea580c" fill="#ea580c" fillOpacity={0.3} />
                  <Radar name="IDPs (milliers)" dataKey="idps" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                  <Radar name="Incidents (×10)" dataKey="incidents" stroke="#eab308" fill="#eab308" fillOpacity={0.3} />
                  <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: '12px' }} />
                  <Tooltip content={<CustomTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div style={{
              gridColumn: '1 / -1',
              background: 'rgba(30, 41, 59, 0.95)',
              borderRadius: '16px',
              padding: '24px',
              border: '2px solid rgba(148, 163, 184, 0.1)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600', fontFamily: '"Playfair Display", Georgia, serif' }}>
                Analyse Comparative Multi-Indicateurs par Région
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={regionalComparison.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis dataKey="region" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-45} textAnchor="end" height={120} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: '13px' }} />
                  <Bar dataKey="closedSchools" fill="#dc2626" name="Écoles fermées" />
                  <Bar dataKey="events" fill="#eab308" name="Incidents" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{
              gridColumn: '1 / -1',
              background: 'rgba(30, 41, 59, 0.95)',
              borderRadius: '16px',
              padding: '24px',
              border: '2px solid rgba(148, 163, 184, 0.1)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600', fontFamily: '"Playfair Display", Georgia, serif' }}>
                Analyse Comparative Multi-Indicateurs par Province
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={provincialComparison.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis dataKey="province" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 9 }} angle={-45} textAnchor="end" height={140} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: '13px' }} />
                  <Bar dataKey="closedSchools" fill="#dc2626" name="Écoles fermées" />
                  <Bar dataKey="events" fill="#eab308" name="Incidents" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Animation controls */}
            <div style={{
              gridColumn: '1 / -1',
              background: 'rgba(30, 41, 59, 0.95)',
              borderRadius: '16px',
              padding: '24px',
              border: '2px solid rgba(148, 163, 184, 0.1)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
              textAlign: 'center'
            }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600', fontFamily: '"Playfair Display", Georgia, serif' }}>
                Animation Temporelle
              </h3>
              <div style={{ marginBottom: '20px' }}>
                <button
                  onClick={() => setIsAnimating(!isAnimating)}
                  style={{
                    padding: '12px 32px',
                    background: isAnimating ? '#dc2626' : '#22c55e',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginRight: '16px'
                  }}
                >
                  {isAnimating ? '⏸ Pause' : '▶ Lire l\'animation'}
                </button>
                <button
                  onClick={() => setAnimationYear(2018)}
                  style={{
                    padding: '12px 32px',
                    background: 'rgba(51, 65, 85, 0.8)',
                    border: '2px solid rgba(148, 163, 184, 0.3)',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  ↺ Réinitialiser
                </button>
              </div>
              <div style={{ fontSize: '48px', fontWeight: '700', color: '#dc2626', marginBottom: '20px', fontFamily: '"Playfair Display", Georgia, serif' }}>
                {animationYear}
              </div>
              <input
                type="range"
                min="2018"
                max="2022"
                value={animationYear}
                onChange={(e) => setAnimationYear(parseInt(e.target.value))}
                style={{ width: '80%', maxWidth: '600px' }}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        background: 'rgba(15, 23, 42, 0.95)',
        padding: '24px 32px',
        borderTop: '2px solid rgba(220, 38, 38, 0.3)',
        marginTop: '48px',
        textAlign: 'center'
      }}>
        <p style={{ margin: '0', color: '#94a3b8', fontSize: '14px', fontFamily: '"Inter", sans-serif' }}>
          © 2025 Tableau de Bord Humanitaire - Burkina Faso | Données: {filters.month} {filters.year} | 
          <span style={{ color: '#dc2626', fontWeight: '600' }}> Analyse Géospatiale Interactive</span>
        </p>
      </footer>
    </div>
  );
};

export default App;
