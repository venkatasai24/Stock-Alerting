import axios from "axios";

// Fallback covers ~400 widely-traded NSE stocks (used until live list loads)
const FALLBACK = [
  ["20MICRONS","20 Microns Ltd"],["3IINFRA","3i Infotech Ltd"],
  ["AARTIIND","Aarti Industries Ltd"],["AAVAS","Aavas Financiers Ltd"],
  ["ABB","ABB India Ltd"],["ABBOTINDIA","Abbott India Ltd"],
  ["ABCAPITAL","Aditya Birla Capital Ltd"],["ABFRL","Aditya Birla Fashion & Retail"],
  ["ACC","ACC Ltd"],["ADANIENT","Adani Enterprises Ltd"],
  ["ADANIGREEN","Adani Green Energy Ltd"],["ADANIPORTS","Adani Ports & SEZ Ltd"],
  ["ADANIPOWER","Adani Power Ltd"],["ADANITRANS","Adani Transmission Ltd"],
  ["AFFLE","Affle India Ltd"],["AJANTPHARM","Ajanta Pharma Ltd"],
  ["ALKEM","Alkem Laboratories Ltd"],["ALKYLAMINE","Alkyl Amines Chemicals Ltd"],
  ["AMARAJABAT","Amara Raja Batteries Ltd"],["AMBUJACEM","Ambuja Cements Ltd"],
  ["ANGELONE","Angel One Ltd"],["APLAPOLLO","APL Apollo Tubes Ltd"],
  ["APOLLOHOSP","Apollo Hospitals Enterprise Ltd"],["APOLLOTYRE","Apollo Tyres Ltd"],
  ["ASAHIINDIA","Asahi India Glass Ltd"],["ASHOKLEY","Ashok Leyland Ltd"],
  ["ASIANPAINT","Asian Paints Ltd"],["ASTERDM","Aster DM Healthcare Ltd"],
  ["ASTRAL","Astral Ltd"],["ATGL","Adani Total Gas Ltd"],
  ["ATUL","Atul Ltd"],["AUBANK","AU Small Finance Bank Ltd"],
  ["AUROPHARMA","Aurobindo Pharma Ltd"],["AVANTIFEED","Avanti Feeds Ltd"],
  ["AXISBANK","Axis Bank Ltd"],
  ["BAJAJ-AUTO","Bajaj Auto Ltd"],["BAJAJFINSV","Bajaj Finserv Ltd"],
  ["BAJAJHLDNG","Bajaj Holdings & Investment Ltd"],["BAJFINANCE","Bajaj Finance Ltd"],
  ["BALKRISIND","Balkrishna Industries Ltd"],["BANDHANBNK","Bandhan Bank Ltd"],
  ["BANKBARODA","Bank of Baroda"],["BANKINDIA","Bank of India"],
  ["BATAINDIA","Bata India Ltd"],["BEL","Bharat Electronics Ltd"],
  ["BERGEPAINT","Berger Paints India Ltd"],["BHARATFORG","Bharat Forge Ltd"],
  ["BHARTIARTL","Bharti Airtel Ltd"],["BHEL","Bharat Heavy Electricals Ltd"],
  ["BIOCON","Biocon Ltd"],["BPCL","Bharat Petroleum Corporation Ltd"],
  ["BRITANNIA","Britannia Industries Ltd"],["BSE","BSE Ltd"],
  ["CAMS","Computer Age Management Services Ltd"],
  ["CANFINHOME","Can Fin Homes Ltd"],["CANBK","Canara Bank"],
  ["CAPLIPOINT","Caplin Point Laboratories Ltd"],
  ["CARBORUNIV","Carborundum Universal Ltd"],["CASTROLIND","Castrol India Ltd"],
  ["CEATLTD","CEAT Ltd"],["CENTRALBK","Central Bank of India"],
  ["CESC","CESC Ltd"],["CGPOWER","CG Power & Industrial Solutions"],
  ["CHAMBLFERT","Chambal Fertilizers & Chemicals"],
  ["CHOLAFIN","Cholamandalam Investment & Finance"],
  ["CIPLA","Cipla Ltd"],["COALINDIA","Coal India Ltd"],
  ["COCOLABOL","Cocola Beverages"],["COFORGE","Coforge Ltd"],
  ["COLPAL","Colgate-Palmolive India Ltd"],
  ["CONCOR","Container Corporation of India"],
  ["COROMANDEL","Coromandel International Ltd"],
  ["CORONA","Corona Remedies Ltd"],["CORONALAB","Corona Lab"],
  ["CRISIL","CRISIL Ltd"],["CROMPTON","Crompton Greaves Consumer Elect"],
  ["CSBBANK","CSB Bank Ltd"],["CUB","City Union Bank Ltd"],
  ["DABUR","Dabur India Ltd"],["DALBHARAT","Dalmia Bharat Ltd"],
  ["DATAPATTNS","Data Patterns India Ltd"],["DELHIVERY","Delhivery Ltd"],
  ["DELTACORP","Delta Corp Ltd"],["DEVYANI","Devyani International Ltd"],
  ["DHANI","Dhani Services Ltd"],["DIVISLAB","Divi's Laboratories Ltd"],
  ["DIXON","Dixon Technologies India Ltd"],["DLF","DLF Ltd"],
  ["DRREDDY","Dr Reddy's Laboratories Ltd"],
  ["ECLERX","eClerx Services Ltd"],["EDELWEISS","Edelweiss Financial Services"],
  ["EICHERMOT","Eicher Motors Ltd"],["ELGIEQUIP","Elgi Equipments Ltd"],
  ["EMAMILTD","Emami Ltd"],["ENDURANCE","Endurance Technologies Ltd"],
  ["ENGINERSIN","Engineers India Ltd"],["EQUITASBNK","Equitas Small Finance Bank"],
  ["ERIS","Eris Lifesciences Ltd"],["ESCORTS","Escorts Kubota Ltd"],
  ["EXIDEIND","Exide Industries Ltd"],
  ["FACT","Fertilizers & Chemicals Travancore"],["FCONSUMER","Future Consumer Ltd"],
  ["FEDERALBNK","The Federal Bank Ltd"],["FINEORG","Fine Organic Industries Ltd"],
  ["FINPIPE","Finolex Industries Ltd"],["FLUOROCHEM","Gujarat Fluorochemicals Ltd"],
  ["FORTIS","Fortis Healthcare Ltd"],["FSL","Firstsource Solutions Ltd"],
  ["GAIL","GAIL India Ltd"],["GALAXYSURF","Galaxy Surfactants Ltd"],
  ["GARFIBRES","Garware Technical Fibres Ltd"],
  ["GLAND","Gland Pharma Ltd"],["GLAXO","GlaxoSmithKline Pharmaceuticals"],
  ["GLENMARK","Glenmark Pharmaceuticals Ltd"],["GMRINFRA","GMR Airports Infrastructure"],
  ["GNFC","Gujarat Narmada Valley Fert & Chem"],
  ["GODREJAGRO","Godrej Agrovet Ltd"],["GODREJCP","Godrej Consumer Products Ltd"],
  ["GODREJIND","Godrej Industries Ltd"],["GODREJPROP","Godrej Properties Ltd"],
  ["GRANULES","Granules India Ltd"],["GRAPHITE","Graphite India Ltd"],
  ["GRASIM","Grasim Industries Ltd"],["GRINDWELL","Grindwell Norton Ltd"],
  ["GSPL","Gujarat State Petronet Ltd"],["GUJGASLTD","Gujarat Gas Ltd"],
  ["HAL","Hindustan Aeronautics Ltd"],["HAPPSTMNDS","Happiest Minds Technologies"],
  ["HCLTECH","HCL Technologies Ltd"],["HDFCAMC","HDFC AMC Ltd"],
  ["HDFCBANK","HDFC Bank Ltd"],["HDFCLIFE","HDFC Life Insurance Co Ltd"],
  ["HEROMOTOCO","Hero MotoCorp Ltd"],["HFCL","HFCL Ltd"],
  ["HINDALCO","Hindalco Industries Ltd"],["HINDCOPPER","Hindustan Copper Ltd"],
  ["HINDPETRO","Hindustan Petroleum Corporation"],["HINDUNILVR","Hindustan Unilever Ltd"],
  ["HONAUT","Honeywell Automation India Ltd"],["HUDCO","Housing & Urban Dev Corp Ltd"],
  ["ICICIBANK","ICICI Bank Ltd"],["ICICIGI","ICICI Lombard General Insurance"],
  ["ICICIPRULI","ICICI Prudential Life Insurance"],["IDFCFIRSTB","IDFC First Bank Ltd"],
  ["IEX","Indian Energy Exchange Ltd"],["IGL","Indraprastha Gas Ltd"],
  ["INDGN","Indigo Paints Ltd"],["INDHOTEL","Indian Hotels Co Ltd"],
  ["INDIAMART","IndiaMART InterMESH Ltd"],["INDIAMOTOR","India Motor Parts & Accessories"],
  ["INDIGO","InterGlobe Aviation Ltd"],["INDUSINDBK","IndusInd Bank Ltd"],
  ["INDUSTOWER","Indus Towers Ltd"],["INFY","Infosys Ltd"],
  ["IOC","Indian Oil Corporation Ltd"],["IPCALAB","IPCA Laboratories Ltd"],
  ["IRB","IRB Infrastructure Developers Ltd"],["IRFC","Indian Railway Finance Corp Ltd"],
  ["ITC","ITC Ltd"],
  ["JBCHEPHARM","JB Chemicals & Pharmaceuticals"],["JINDALPOLY","Jindal Poly Films Ltd"],
  ["JINDALSAW","Jindal Saw Ltd"],["JINDALSTEL","Jindal Stainless Ltd"],
  ["JSL","Jindal Stainless (Hisar) Ltd"],["JSWENERGY","JSW Energy Ltd"],
  ["JSWSTEEL","JSW Steel Ltd"],["JUBLFOOD","Jubilant FoodWorks Ltd"],
  ["JUBILANT","Jubilant Pharmova Ltd"],
  ["KAJARIACER","Kajaria Ceramics Ltd"],["KALPATPOWR","KalpatTree Power Ltd"],
  ["KANSAINER","Kansai Nerolac Paints Ltd"],["KAYNES","Kaynes Technology India Ltd"],
  ["KEC","KEC International Ltd"],["KFINTECH","KFin Technologies Ltd"],
  ["KIMS","KIMS Ltd"],["KNRCON","KNR Constructions Ltd"],
  ["KOTAKBANK","Kotak Mahindra Bank Ltd"],["KPITTECH","KPIT Technologies Ltd"],
  ["KRBL","KRBL Ltd"],["KSCL","Kaveri Seed Company Ltd"],
  ["LT","Larsen & Toubro Ltd"],["LATENTVIEW","Latent View Analytics Ltd"],
  ["LAURUSLABS","Laurus Labs Ltd"],["LICI","Life Insurance Corporation of India"],
  ["LINDEINDIA","Linde India Ltd"],["LTF","L&T Finance Ltd"],
  ["LTIM","LTIMindtree Ltd"],["LTTS","L&T Technology Services Ltd"],
  ["LUPIN","Lupin Ltd"],
  ["M&M","Mahindra & Mahindra Ltd"],["M&MFIN","Mahindra & Mahindra Financial"],
  ["MANAPPURAM","Manappuram Finance Ltd"],["MARICO","Marico Ltd"],
  ["MARUTI","Maruti Suzuki India Ltd"],["MAXHEALTH","Max Healthcare Institute Ltd"],
  ["MCX","Multi Commodity Exchange of India"],["METROPOLIS","Metropolis Healthcare Ltd"],
  ["MFSL","Max Financial Services Ltd"],["MHRIL","Mahindra Holidays & Resorts India"],
  ["MINDAIND","Minda Industries Ltd"],["MINDTREE","Mindtree Ltd"],
  ["MPHASIS","Mphasis Ltd"],["MRF","MRF Ltd"],
  ["MSTCLTD","MSTC Ltd"],["MUTHOOTFIN","Muthoot Finance Ltd"],
  ["NATCOPHARM","Natco Pharma Ltd"],["NAUKRI","Info Edge India Ltd"],
  ["NAVINFLUOR","Navin Fluorine International"],["NAZARA","Nazara Technologies Ltd"],
  ["NESTLEIND","Nestle India Ltd"],["NETWORK18","Network18 Media & Investments"],
  ["NIACL","The New India Assurance Co Ltd"],["NLCINDIA","NLC India Ltd"],
  ["NMDC","NMDC Ltd"],["NTPC","NTPC Ltd"],["NUVAMA","Nuvama Wealth Management Ltd"],
  ["NYKAA","FSN E-Commerce Ventures Ltd"],
  ["OBEROIRLTY","Oberoi Realty Ltd"],["OFSS","Oracle Financial Services Software"],
  ["ONGC","Oil & Natural Gas Corporation Ltd"],["ORIENTELEC","Orient Electric Ltd"],
  ["PAGEIND","Page Industries Ltd"],["PATANJALI","Patanjali Foods Ltd"],
  ["PAYTM","One 97 Communications Ltd"],["PEL","Piramal Enterprises Ltd"],
  ["PERSISTENT","Persistent Systems Ltd"],["PETRONET","Petronet LNG Ltd"],
  ["PFC","Power Finance Corporation Ltd"],["PFIZER","Pfizer Ltd"],
  ["PIIND","PI Industries Ltd"],["PIDILITIND","Pidilite Industries Ltd"],
  ["PNBHOUSING","PNB Housing Finance Ltd"],["POLYCAB","Polycab India Ltd"],
  ["POLYMED","Poly Medicure Ltd"],["PRAJ","Praj Industries Ltd"],
  ["PRESTIGE","Prestige Estates Projects Ltd"],["PRINCEPIPE","Prince Pipes & Fittings Ltd"],
  ["PSUBNK","Public Sector Banks"],["PVRINOX","PVR INOX Ltd"],
  ["RAYMOND","Raymond Ltd"],["RCF","Rashtriya Chemicals & Fertilizers"],
  ["RECLTD","REC Ltd"],["RELAXO","Relaxo Footwears Ltd"],
  ["RELIANCE","Reliance Industries Ltd"],["RPOWER","Reliance Power Ltd"],
  ["SANOFI","Sanofi India Ltd"],["SBFC","SBFC Finance Ltd"],
  ["SBICARD","SBI Cards & Payment Services"],["SBILIFE","SBI Life Insurance Co Ltd"],
  ["SBIN","State Bank of India"],["SCHAEFFLER","Schaeffler India Ltd"],
  ["SEQUENT","Sequent Scientific Ltd"],["SHREECEM","Shree Cement Ltd"],
  ["SHRIRAMFIN","Shriram Finance Ltd"],["SIEMENS","Siemens Ltd"],
  ["SKFINDIA","SKF India Ltd"],["SRF","SRF Ltd"],
  ["STAR","Star Health & Allied Insurance"],["STARTECK","Star Teck Lifesciences Ltd"],
  ["SUMICHEM","Sumitomo Chemical India Ltd"],["SUNPHARMA","Sun Pharmaceutical Industries"],
  ["SUNTV","Sun TV Network Ltd"],["SUPREMEIND","Supreme Industries Ltd"],
  ["SUVENPHAR","Suven Pharmaceuticals Ltd"],
  ["TATACHEMICALS","Tata Chemicals Ltd"],["TATACOMM","Tata Communications Ltd"],
  ["TATACONSUM","Tata Consumer Products Ltd"],["TATAELXSI","Tata Elxsi Ltd"],
  ["TATAMOTORS","Tata Motors Ltd"],["TATAPOWER","Tata Power Co Ltd"],
  ["TATASTEEL","Tata Steel Ltd"],["TCS","Tata Consultancy Services Ltd"],
  ["TEAMLEASE","TeamLease Services Ltd"],["TECHM","Tech Mahindra Ltd"],
  ["THERMAX","Thermax Ltd"],["TIMKEN","Timken India Ltd"],
  ["TITAGARH","Titagarh Rail Systems Ltd"],["TITAN","Titan Company Ltd"],
  ["TORNTPHARM","Torrent Pharmaceuticals Ltd"],["TORNTPOWER","Torrent Power Ltd"],
  ["TRENT","Trent Ltd"],["TRIDENT","Trident Ltd"],
  ["TTKPRESTIG","TTK Prestige Ltd"],["TV18BRDCST","TV18 Broadcast Ltd"],
  ["TVSMOTOR","TVS Motor Company Ltd"],
  ["UBL","United Breweries Ltd"],["UCALFUEL","Ucal Fuel Systems Ltd"],
  ["ULTRACEMCO","UltraTech Cement Ltd"],["UNIONBANK","Union Bank of India"],
  ["UPL","UPL Ltd"],["UTIAMCLTD","UTI AMC Ltd"],
  ["VAIBHAVGBL","Vaibhav Global Ltd"],["VBL","Varun Beverages Ltd"],
  ["VEDL","Vedanta Ltd"],["VESUVIUS","Vesuvius India Ltd"],
  ["VINATIORGA","Vinati Organics Ltd"],["VOLTAS","Voltas Ltd"],
  ["WABAG","VA Tech Wabag Ltd"],["WELCORP","Welspun Corp Ltd"],
  ["WELSPUNIND","Welspun India Ltd"],["WHIRLPOOL","Whirlpool of India Ltd"],
  ["WIPRO","Wipro Ltd"],["WOCKPHARMA","Wockhardt Ltd"],
  ["XCHANGING","Xchanging Solutions Ltd"],
  ["YESBANK","Yes Bank Ltd"],
  ["ZEEL","Zee Entertainment Enterprises"],["ZEEMEDIA","Zee Media Corporation Ltd"],
  ["ZOMATO","Zomato Ltd"],["ZYDUSLIFE","Zydus Lifesciences Ltd"],
  ["ZYDUSWELL","Zydus Wellness Ltd"],
];

let stockList = FALLBACK.map(([s, n]) => ({ symbol: s, name: n, type: "EQ" }));
let liveLoaded = false;

// Series we want to include in search results
const KEEP_SERIES = new Set(["EQ", "BE", "BZ", "SM", "ETF", "INVIT", "REIT", "InvIT"]);

async function fetchCsv(url) {
  const { data } = await axios.get(url, {
    timeout: 12000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/csv,text/plain,*/*",
    },
    responseType: "text",
  });
  return data;
}

export async function initNseCache() {
  const parsed = [];

  // 1. Equity list — covers EQ, BE, BZ, SM series
  try {
    const csv = await fetchCsv("https://archives.nseindia.com/content/equities/EQUITY_L.csv");
    for (const line of csv.split("\n").slice(1)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const cols = parseCsvLine(trimmed);
      if (cols[0] && cols[1] && KEEP_SERIES.has(cols[2]?.trim())) {
        const series = cols[2]?.trim();
        const type = series === "ETF" ? "ETF"
          : (series === "INVIT" || series === "InvIT") ? "InvIT"
          : series === "REIT" ? "REIT"
          : "EQ";
        parsed.push({ symbol: cols[0].trim(), name: cols[1].trim(), type });
      }
    }
    console.log(`[NSE] Equity list: ${parsed.length} instruments`);
  } catch (e) {
    console.warn(`[NSE] Equity list fetch failed (${e.message})`);
  }

  // 2. ETF list — separate file NSE publishes
  try {
    const csv = await fetchCsv("https://archives.nseindia.com/content/equities/eq_etfseclist.csv");
    const before = parsed.length;
    const seen = new Set(parsed.map(s => s.symbol));
    for (const line of csv.split("\n").slice(1)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const cols = parseCsvLine(trimmed);
      if (cols[0] && cols[1] && !seen.has(cols[0].trim())) {
        parsed.push({ symbol: cols[0].trim(), name: cols[1].trim(), type: "ETF" });
        seen.add(cols[0].trim());
      }
    }
    console.log(`[NSE] ETF list: +${parsed.length - before} ETFs`);
  } catch (e) {
    console.warn(`[NSE] ETF list fetch failed (${e.message}) — ETFs may be limited`);
  }

  if (parsed.length > 100) {
    stockList = parsed;
    liveLoaded = true;
    console.log(`[NSE] Cache ready — ${parsed.length} total instruments`);
  } else {
    console.warn("[NSE] Both fetches failed — using built-in fallback");
  }
}

function parseCsvLine(line) {
  const parts = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === "," && !inQ) { parts.push(cur); cur = ""; }
    else { cur += ch; }
  }
  parts.push(cur);
  return parts;
}

export function searchNse(q, limit = 15) {
  const query = q.toLowerCase().trim();
  if (!query) return [];

  const bySymbol = [];
  const byName   = [];

  for (const s of stockList) {
    const sym  = s.symbol.toLowerCase();
    const name = s.name.toLowerCase();

    if (sym.startsWith(query)) {
      bySymbol.push(s);
    } else if (sym.includes(query) || name.includes(query)) {
      byName.push(s);
    }

    if (bySymbol.length + byName.length >= limit * 3) break;
  }

  return [...bySymbol, ...byName]
    .slice(0, limit)
    .map(s => ({ symbol: s.symbol, name: s.name, type: s.type || "EQ", exchange: "NSE" }));
}
