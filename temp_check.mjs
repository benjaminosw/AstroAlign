import * as Astronomy from 'astronomy-engine'; 
const obs = new Astronomy.Observer(37.7749, -122.4194, 0); 
const start = new Date(Date.UTC(2025,8,22,7,0,0)); 
const rise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, 1, start, 2, 0); 
const set = Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, -1, start, 2, 0); 
console.log('rise', rise ? rise.date.toISOString() : null); 
console.log('set', set ? set.date.toISOString() : null); 
if (rise) { const pos = Astronomy.Horizon(rise.date, obs, true, true); console.log('rise az', pos.azimuth, 'alt', pos.altitude); } 
if (set) { const pos = Astronomy.Horizon(set.date, obs, true, true); console.log('set az', pos.azimuth, 'alt', pos.altitude); } 
