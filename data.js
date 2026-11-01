/* Fleet Architect starter registry.
   The ratings are editable planning heuristics (1–5), NOT official game statistics.
   CP and hangar capacities are editable; verify them against your current blueprints.
   Starter ownership is based on units discussed with the user, not an inventory sync.
*/
window.FLEET_STARTERS = [
  // User-discussed blueprints
  {id:'eris',name:'Eris I',variant:'Maneuver Assault',type:'Destroyer',row:'Front',cp:8,owned:true,qty:4,atk:3,tank:5,aa:1,support:1,notes:'Front-line evasive destroyer. Check the exact variant and CP in game.'},
  {id:'taurus',name:'Taurus',variant:'Pulse Cannon',type:'Destroyer',row:'Front',cp:8,owned:true,qty:3,atk:5,tank:4,aa:2,support:1,notes:'Front-line energy damage; useful when smaller ships need to be cleared.'},
  {id:'xenostinger',name:'XenoStinger',variant:'Special',type:'Frigate',row:'Back',cp:6,owned:true,qty:4,atk:5,tank:1,aa:1,support:1,notes:'High-damage fragile specialist. Row/variant must be verified.'},
  {id:'hussar',name:'Winged Hussar',variant:'Light Missile',type:'Destroyer',row:'Middle',cp:8,owned:true,qty:4,atk:4,tank:2,aa:2,support:1,notes:'Missile damage; verify whether you own A/B/C variant.'},
  {id:'callisto',name:'Callisto',variant:'Torpedo',type:'Cruiser',row:'Middle',cp:18,owned:true,qty:2,atk:5,tank:3,aa:1,support:1,notes:'Heavy ship damage. Check variant and position.'},
  {id:'storm',name:'Eternal Storm',variant:'Attack Battlecruiser',type:'Battlecruiser',row:'Middle',cp:35,owned:true,qty:1,atk:5,tank:3,aa:2,support:1,notes:'Middle-row capital ship. Aircraft can bypass the front row; AA support matters.'},
  {id:'somme',name:'Shadow of the Somme',variant:'Corvette',type:'Corvette',row:'Aircraft',cp:0,owned:true,qty:3,atk:4,tank:2,aa:1,support:1,notes:'Corvette: needs compatible hangar capacity.'},
  {id:'vitas',name:'Vitas-B010',variant:'Bomber',type:'Fighter',row:'Aircraft',cp:0,owned:true,qty:2,atk:5,tank:1,aa:1,support:1,size:'Large',notes:'Large fighter/bomber. Ceres aircraft variant cannot host large fighters.'},
  {id:'ac721',name:'AC721',variant:'Aircraft Type',type:'Destroyer',row:'Back',cp:8,owned:true,qty:4,atk:1,tank:2,aa:1,support:2,corvetteSlots:2,notes:'Hosts two corvettes; the CP shown is an editable planning value.'},
  {id:'kccpv',name:'KCCPV2.0',variant:'Light Aircraft Cruiser',type:'Cruiser',row:'Back',cp:16,owned:true,qty:2,atk:2,tank:2,aa:1,support:2,fighterSlots:2,largeFighterSlots:2,notes:'Can host two large-fighter squadrons; check current CP.'},
  {id:'ceres',name:'Ceres',variant:'Aircraft Destroyer',type:'Destroyer',row:'Back',cp:8,owned:true,qty:3,atk:1,tank:2,aa:2,support:3,fighterSlots:2,largeFighterSlots:0,notes:'Two medium/small fighter squadrons only. Change variant if you have Support or Tactical.'},
  // Example catalog, disabled until the player marks ownership
  {id:'fg300',name:'FG300',variant:'Armored',type:'Frigate',row:'Front',cp:5,owned:false,qty:5,atk:1,tank:4,aa:1,support:1,notes:'Starter frigate; verify your specific variant.'},
  {id:'fg300multi',name:'FG300',variant:'Multi-role',type:'Frigate',row:'Middle',cp:5,owned:false,qty:5,atk:2,tank:2,aa:1,support:1},
  {id:'carilion',name:'Carilion',variant:'Special / Recon',type:'Frigate',row:'Front',cp:6,owned:false,qty:4,atk:2,tank:5,aa:1,support:1},
  {id:'ruby',name:'Ruby',variant:'Railgun',type:'Frigate',row:'Middle',cp:6,owned:false,qty:4,atk:4,tank:2,aa:1,support:1},
  {id:'noma',name:'NOMA M470',variant:'Support',type:'Frigate',row:'Back',cp:6,owned:false,qty:3,atk:1,tank:1,aa:2,support:5},
  {id:'tundra',name:'Tundra',variant:'Tactical',type:'Destroyer',row:'Back',cp:8,owned:false,qty:3,atk:1,tank:2,aa:3,support:5},
  {id:'guardian',name:'Guardian',variant:'Support',type:'Destroyer',row:'Middle',cp:8,owned:false,qty:3,atk:2,tank:3,aa:2,support:4},
  {id:'cas066',name:'CAS066',variant:'Generic',type:'Cruiser',row:'Front',cp:18,owned:false,qty:3,atk:3,tank:5,aa:2,support:1},
  {id:'predator',name:'Predator',variant:'Aircraft Cruiser',type:'Cruiser',row:'Back',cp:18,owned:false,qty:2,atk:2,tank:2,aa:1,support:2,fighterSlots:4,largeFighterSlots:4},
  {id:'st59',name:'ST59',variant:'Defensive Battlecruiser',type:'Battlecruiser',row:'Front',cp:35,owned:false,qty:1,atk:3,tank:5,aa:2,support:1},
  {id:'constantine',name:'Constantine the Great',variant:'Battlecruiser',type:'Battlecruiser',row:'Middle',cp:35,owned:false,qty:1,atk:5,tank:3,aa:2,support:1},
  {id:'cv3000',name:'CV3000',variant:'High-Speed Carrier',type:'Carrier',row:'Back',cp:40,owned:false,qty:1,atk:1,tank:3,aa:2,support:3,fighterSlots:5,largeFighterSlots:5,corvetteSlots:3},
  {id:'solarwhale',name:'Solar Whale',variant:'Armed Tactical Carrier',type:'Carrier',row:'Back',cp:55,owned:false,qty:1,atk:2,tank:4,aa:2,support:4,fighterSlots:6,largeFighterSlots:6,corvetteSlots:6},
  {id:'cellular',name:'Cellular Defender',variant:'Heavy Torpedo',type:'Corvette',row:'Aircraft',cp:0,owned:false,qty:5,atk:5,tank:2,aa:1,support:1},
  {id:'nebula',name:'Nebula Chaser',variant:'Ballistic',type:'Corvette',row:'Aircraft',cp:0,owned:false,qty:5,atk:4,tank:2,aa:1,support:1},
  {id:'vitasA',name:'Vitas-A021',variant:'Heavy Attacker',type:'Fighter',row:'Aircraft',cp:0,owned:false,qty:4,atk:4,tank:2,aa:1,support:1,size:'Large'},
  {id:'mistral',name:'Mistral',variant:'Anti-Air Fighter',type:'Fighter',row:'Aircraft',cp:0,owned:false,qty:5,atk:2,tank:2,aa:5,support:1,size:'Medium'},
  {id:'spore',name:'Spore A404',variant:'Fighter',type:'Fighter',row:'Aircraft',cp:0,owned:false,qty:5,atk:2,tank:2,aa:4,support:1,size:'Medium'}
];
window.FLEET_REFERENCES = [
  {title:'Official: aircraft and air defense mechanics',url:'https://www.infinitelagrange.com/news/20210915/35106_972544.html'},
  {title:'Wiki: transporting fighters and corvettes',url:'https://infinite-lagrange.fandom.com/wiki/Transporting_Fighters_and_Corvettes'},
  {title:'Wiki: AC721 aircraft variant',url:'https://infinite-lagrange.fandom.com/wiki/AC721_-_Heavy_Dual-Purpose_Assault_Ship'},
  {title:'Wiki: Ceres aircraft variant',url:'https://infinite-lagrange.fandom.com/wiki/Ceres_-_Aircraft_Destroyer'}
];