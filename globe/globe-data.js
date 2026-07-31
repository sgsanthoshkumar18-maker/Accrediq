/* AQcredix — Healthcare Globe: data module
   ------------------------------------------------------------
   HONESTY NOTE (read this before wiring up real data):
   - Continent outlines below are a hand-simplified, stylized approximation
     for visual effect — not survey-accurate GIS boundaries. Swap in a real
     GeoJSON/TopoJSON world dataset (e.g. Natural Earth 110m) for precision.
   - HOSPITALS is a small, clearly-labeled SAMPLE/illustrative dataset.
     Names, bed counts, ratings, phone numbers and "public"/"private" status
     are placeholders for demoing the interaction model — not verified real
     facts about any specific institution. Replace with a verified directory
     before treating any of it as real-world information.
   - Indian state capitals use real, accurate coordinates (this part IS
     factual) since AQcredix is NABH/India-focused — used to demonstrate the
     Country → State → City drill-down depth for one fully-populated country.
   ------------------------------------------------------------ */

window.GLOBE_DATA = (function () {

  // Rough continent silhouettes as [lat, lon] point lists — stylized dot-outline, not precise.
  const CONTINENTS = {
    "North America": [[70,-160],[66,-140],[60,-141],[55,-130],[50,-125],[40,-124],[32,-117],[23,-109],
      [18,-105],[16,-95],[19,-97],[21,-97],[25,-97],[29,-95],[30,-89],[29,-83],[25,-80],[27,-80],
      [35,-76],[40,-74],[44,-67],[47,-60],[50,-60],[55,-60],[58,-65],[60,-70],[63,-78],[66,-85],
      [68,-95],[70,-110],[71,-130],[70,-160]],
    "South America": [[12,-72],[10,-75],[4,-77],[-2,-80],[-8,-79],[-14,-76],[-18,-70],[-23,-70],
      [-30,-71],[-38,-73],[-45,-73],[-52,-70],[-54,-68],[-52,-64],[-46,-65],[-38,-58],[-34,-58],
      [-30,-51],[-23,-43],[-13,-38],[-8,-35],[-3,-40],[0,-50],[4,-52],[8,-60],[10,-65],[12,-72]],
    "Africa": [[37,10],[35,-6],[31,-9],[27,-13],[21,-17],[14,-17],[8,-13],[5,-8],[5,0],[4,9],
      [-4,9],[-9,13],[-15,12],[-22,14],[-29,17],[-34,19],[-34,25],[-30,31],[-25,33],[-20,35],
      [-12,40],[-4,39],[2,45],[10,44],[12,50],[15,42],[20,38],[27,34],[31,32],[34,26],[37,10]],
    "Europe": [[71,25],[68,20],[63,14],[59,5],[57,8],[55,8],[53,7],[51,3],[49,-2],[48,-5],
      [44,-2],[43,3],[41,3],[38,-9],[37,-8],[40,-8],[43,10],[45,13],[41,16],[38,16],[40,20],
      [37,23],[40,26],[41,29],[45,29],[47,29],[50,26],[52,21],[54,20],[57,24],[60,25],[65,25],[71,25]],
    "Asia": [[70,60],[68,80],[73,105],[71,150],[64,178],[60,163],[55,163],[53,158],[45,142],
      [42,131],[38,128],[35,129],[33,130],[31,121],[23,113],[16,108],[10,106],[1,104],[-6,106],
      [-8,115],[-8,119],[5,95],[13,93],[21,89],[22,90],[24,88],[28,84],[30,79],[35,74],[34,71],
      [30,66],[25,61],[26,56],[24,53],[19,57],[13,44],[15,42],[20,38],[27,34],[33,35],[36,36],
      [37,41],[41,44],[43,46],[45,48],[50,52],[55,55],[60,55],[65,55],[70,60]],
    "Australia": [[-11,131],[-13,136],[-12,141],[-16,145],[-19,146],[-24,153],[-28,153],[-33,151],
      [-38,147],[-38,141],[-35,136],[-32,133],[-32,127],[-31,115],[-26,113],[-20,113],[-16,122],
      [-14,126],[-11,131]],
  };

  // Approx country centroids for camera fly-to + marker filtering. [lat, lon]
  const COUNTRIES = {
    "India": [22.0, 79.0], "United States": [39.5, -98.0], "United Kingdom": [54.0, -2.5],
    "United Arab Emirates": [24.0, 54.0], "Singapore": [1.35, 103.8], "Germany": [51.0, 10.0],
    "Australia": [-25.0, 134.0], "South Africa": [-29.0, 24.0], "Brazil": [-10.0, -55.0],
    "Japan": [36.0, 138.0], "Thailand": [15.0, 101.0], "Canada": [56.0, -106.0],
  };

  // Real, accurate coordinates for Indian state capitals — used for the deep
  // Country → State → City drill-down demo.
  const INDIA_STATES = [
    { name:"Tamil Nadu", capital:"Chennai", lat:13.0827, lon:80.2707 },
    { name:"Karnataka", capital:"Bengaluru", lat:12.9716, lon:77.5946 },
    { name:"Maharashtra", capital:"Mumbai", lat:19.0760, lon:72.8777 },
    { name:"Delhi (NCT)", capital:"New Delhi", lat:28.6139, lon:77.2090 },
    { name:"Telangana", capital:"Hyderabad", lat:17.3850, lon:78.4867 },
    { name:"West Bengal", capital:"Kolkata", lat:22.5726, lon:88.3639 },
    { name:"Kerala", capital:"Thiruvananthapuram", lat:8.5241, lon:76.9366 },
    { name:"Gujarat", capital:"Gandhinagar", lat:23.2156, lon:72.6369 },
  ];

  // SAMPLE hospital markers — illustrative only (see honesty note above).
  // Structure is the future-proof contract: swap this array for verified data
  // and everything else (clustering, cards, search) keeps working unchanged.
  const HOSPITALS = [
    // India — Tamil Nadu
    { id:"h1", name:"Chennai City Multispecialty Hospital", country:"India", state:"Tamil Nadu", city:"Chennai",
      lat:13.06, lon:80.25, type:"Private", accreditations:["NABH"], certifications:[],
      rating:4.3, beds:220, phone:"+91 44 4000 1000", listed:false },
    { id:"h2", name:"Coimbatore Regional Medical Centre", country:"India", state:"Tamil Nadu", city:"Coimbatore",
      lat:11.0168, lon:76.9558, type:"Trust", accreditations:["NABH"], certifications:["ISO 9001:2015"],
      rating:4.1, beds:180, phone:"+91 422 400 2000", listed:false },
    // India — Karnataka
    { id:"h3", name:"Bengaluru Institute of Advanced Care", country:"India", state:"Karnataka", city:"Bengaluru",
      lat:12.98, lon:77.60, type:"Private", accreditations:["NABH"], certifications:["NABL"],
      rating:4.5, beds:400, phone:"+91 80 4000 5000", listed:true, ticker:"SAMPLE:BIAC" },
    // India — Maharashtra
    { id:"h4", name:"Mumbai Metropolitan Hospital", country:"India", state:"Maharashtra", city:"Mumbai",
      lat:19.07, lon:72.87, type:"Private", accreditations:["NABH"], certifications:[],
      rating:4.2, beds:350, phone:"+91 22 6100 2000", listed:true, ticker:"SAMPLE:MMH" },
    { id:"h5", name:"Pune Community Health Institute", country:"India", state:"Maharashtra", city:"Pune",
      lat:18.5204, lon:73.8567, type:"Government", accreditations:[], certifications:[],
      rating:3.9, beds:500, phone:"+91 20 2600 1000", listed:false },
    // India — Delhi
    { id:"h6", name:"New Delhi Superspecialty Hospital", country:"India", state:"Delhi (NCT)", city:"New Delhi",
      lat:28.61, lon:77.21, type:"Trust", accreditations:["NABH"], certifications:["ISO 9001:2015"],
      rating:4.4, beds:600, phone:"+91 11 4900 3000", listed:false },
    // India — Telangana
    { id:"h7", name:"Hyderabad Care & Research Centre", country:"India", state:"Telangana", city:"Hyderabad",
      lat:17.38, lon:78.49, type:"Private", accreditations:["NABH"], certifications:[],
      rating:4.3, beds:280, phone:"+91 40 4200 6000", listed:false },
    // India — West Bengal
    { id:"h8", name:"Kolkata General & Trauma Hospital", country:"India", state:"West Bengal", city:"Kolkata",
      lat:22.57, lon:88.36, type:"Government", accreditations:[], certifications:[],
      rating:3.8, beds:450, phone:"+91 33 4000 7000", listed:false },
    // India — Kerala
    { id:"h9", name:"Thiruvananthapuram Wellness Hospital", country:"India", state:"Kerala", city:"Thiruvananthapuram",
      lat:8.52, lon:76.94, type:"Trust", accreditations:["NABH"], certifications:["NABL"],
      rating:4.6, beds:200, phone:"+91 471 400 8000", listed:false },
    // India — Gujarat
    { id:"h10", name:"Ahmedabad Heart & Multispecialty Centre", country:"India", state:"Gujarat", city:"Ahmedabad",
      lat:23.0225, lon:72.5714, type:"Private", accreditations:["NABH"], certifications:[],
      rating:4.2, beds:320, phone:"+91 79 4000 9000", listed:true, ticker:"SAMPLE:AHMC" },

    // Rest of world — one illustrative marker per country, city-level only (no state drill-down yet)
    { id:"h11", name:"Manhattan General Hospital", country:"United States", state:"New York", city:"New York",
      lat:40.7128, lon:-74.0060, type:"Private", accreditations:["JCI"], certifications:[],
      rating:4.4, beds:700, phone:"+1 212 555 0100", listed:true, ticker:"SAMPLE:MGH" },
    { id:"h12", name:"London Central Medical Centre", country:"United Kingdom", state:"England", city:"London",
      lat:51.5072, lon:-0.1276, type:"Trust", accreditations:["JCI"], certifications:[],
      rating:4.3, beds:520, phone:"+44 20 7946 0100", listed:false },
    { id:"h13", name:"Dubai Health Excellence Hospital", country:"United Arab Emirates", state:"Dubai", city:"Dubai",
      lat:25.2048, lon:55.2708, type:"Private", accreditations:["JCI"], certifications:["ISO 9001:2015"],
      rating:4.6, beds:300, phone:"+971 4 555 0100", listed:false },
    { id:"h14", name:"Singapore Precision Care Hospital", country:"Singapore", state:"Central Region", city:"Singapore",
      lat:1.3521, lon:103.8198, type:"Private", accreditations:["JCI"], certifications:[],
      rating:4.7, beds:400, phone:"+65 6555 0100", listed:true, ticker:"SAMPLE:SPCH" },
    { id:"h15", name:"Berlin University-Affiliated Hospital", country:"Germany", state:"Berlin", city:"Berlin",
      lat:52.5200, lon:13.4050, type:"Government", accreditations:[], certifications:["ISO 9001:2015"],
      rating:4.1, beds:650, phone:"+49 30 5550100", listed:false },
    { id:"h16", name:"Sydney Harbour Medical Centre", country:"Australia", state:"New South Wales", city:"Sydney",
      lat:-33.8688, lon:151.2093, type:"Private", accreditations:["JCI"], certifications:[],
      rating:4.4, beds:380, phone:"+61 2 5550 0100", listed:false },
    { id:"h17", name:"Cape Town Regional Hospital", country:"South Africa", state:"Western Cape", city:"Cape Town",
      lat:-33.9249, lon:18.4241, type:"Government", accreditations:[], certifications:[],
      rating:3.9, beds:410, phone:"+27 21 555 0100", listed:false },
    { id:"h18", name:"São Paulo Advanced Care Institute", country:"Brazil", state:"São Paulo", city:"São Paulo",
      lat:-23.5505, lon:-46.6333, type:"Private", accreditations:["JCI"], certifications:[],
      rating:4.2, beds:480, phone:"+55 11 5550 0100", listed:true, ticker:"SAMPLE:SPAC" },
    { id:"h19", name:"Tokyo Metropolitan Care Centre", country:"Japan", state:"Tokyo", city:"Tokyo",
      lat:35.6762, lon:139.6503, type:"Government", accreditations:[], certifications:["ISO 9001:2015"],
      rating:4.5, beds:900, phone:"+81 3 5550 0100", listed:false },
    { id:"h20", name:"Bangkok International Hospital", country:"Thailand", state:"Bangkok", city:"Bangkok",
      lat:13.7563, lon:100.5018, type:"Private", accreditations:["JCI"], certifications:[],
      rating:4.5, beds:350, phone:"+66 2 555 0100", listed:false },
    { id:"h21", name:"Toronto General Care Hospital", country:"Canada", state:"Ontario", city:"Toronto",
      lat:43.6532, lon:-79.3832, type:"Government", accreditations:[], certifications:[],
      rating:4.0, beds:560, phone:"+1 416 555 0100", listed:false },
  ];

  return { CONTINENTS, COUNTRIES, INDIA_STATES, HOSPITALS };
})();
