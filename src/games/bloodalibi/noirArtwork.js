const svgData = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\n\s+/g, " "))}`;

const serif = "Georgia,Times New Roman,serif";

function frameDefs(accent = "#d2a34f", glow = "#7a4c1d") {
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#111517"/><stop offset=".45" stop-color="#070a0b"/><stop offset="1" stop-color="#030405"/></linearGradient>
    <linearGradient id="brass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f2d38d"/><stop offset=".48" stop-color="${accent}"/><stop offset="1" stop-color="#6a471b"/></linearGradient>
    <radialGradient id="lamp"><stop stop-color="#ffd986" stop-opacity=".95"/><stop offset=".22" stop-color="#c96c20" stop-opacity=".75"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity=".9"/></filter>
  </defs>`;
}

function plaque(lines) {
  const split = Array.isArray(lines) ? lines : String(lines).split("|");
  const height = split.length > 1 ? 56 : 42;
  const y = 150 - height / 2;
  return `<g filter="url(#shadow)"><rect x="108" y="${y}" width="204" height="${height}" rx="4" fill="#080808" fill-opacity=".94" stroke="url(#brass)" stroke-width="2"/>
  ${split.map((line, i) => `<text x="210" y="${y + 22 + i * 22}" text-anchor="middle" fill="#f6e6c5" font-family="${serif}" font-size="${split.length > 1 ? 18 : 20}" font-weight="700" letter-spacing="1">${line}</text>`).join("")}</g>`;
}

function roomBase(extra = "") {
  return `<rect width="420" height="300" fill="url(#bg)"/><rect x="5" y="5" width="410" height="290" rx="10" fill="none" stroke="#9c7536" stroke-width="2"/><rect x="11" y="11" width="398" height="278" rx="7" fill="none" stroke="#f0ca7920"/>${extra}`;
}

function greenhouse() {
  let glass = "";
  for (let x = 34; x <= 386; x += 44) glass += `<path d="M${x} 28 L${x-28} 236" stroke="#8aa8a1" stroke-opacity=".24"/>`;
  for (let y = 48; y <= 216; y += 42) glass += `<path d="M28 ${y} H392" stroke="#8aa8a1" stroke-opacity=".20"/>`;
  let plants = "";
  [[46,72],[73,101],[54,164],[356,75],[335,106],[366,170],[89,222],[330,221]].forEach(([x,y],i)=>{plants += `<g transform="translate(${x} ${y})"><circle r="20" fill="#173e25"/><circle cx="-10" cy="-8" r="11" fill="#2e6d3d"/><circle cx="10" cy="-5" r="12" fill="#285b35"/><circle cy="10" r="13" fill="#377b45"/><circle r="3" fill="#e0b765"/></g>`;});
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300">${frameDefs("#d6aa54","#604116")}${roomBase(`<rect x="28" y="28" width="364" height="208" rx="8" fill="#0b1712" stroke="#6a8a7c" stroke-width="2"/>${glass}${plants}<path d="M160 30 Q210 -8 260 30" fill="none" stroke="#87a9a0" stroke-opacity=".45" stroke-width="4"/><rect x="185" y="236" width="50" height="56" fill="#5a210f" stroke="#df8137"/><ellipse cx="210" cy="244" rx="62" ry="38" fill="url(#lamp)"/>`)}${plaque(["ROOFTOP","GREENHOUSE"])}</svg>`;
}

function penthouse() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300">${frameDefs("#d8ab57","#7b4a18")}${roomBase(`<rect x="32" y="28" width="356" height="208" rx="8" fill="#17120e" stroke="#735a37"/><rect x="153" y="45" width="116" height="118" rx="6" fill="#3c3026" stroke="#a9814c"/><rect x="166" y="57" width="90" height="34" rx="12" fill="#d8c5a4"/><rect x="166" y="90" width="90" height="62" rx="4" fill="#72614e"/><rect x="54" y="70" width="72" height="62" rx="8" fill="#2a251f" stroke="#8b744f"/><rect x="294" y="70" width="72" height="62" rx="8" fill="#2a251f" stroke="#8b744f"/><circle cx="89" cy="58" r="38" fill="url(#lamp)"/><circle cx="331" cy="58" r="38" fill="url(#lamp)"/><rect x="68" y="180" width="284" height="42" rx="5" fill="#211a15" stroke="#5d472d"/><path d="M78 201 H342" stroke="#b3864e" stroke-opacity=".35"/><rect x="185" y="236" width="50" height="56" fill="#5a210f" stroke="#df8137"/>`)}${plaque(["PENTHOUSE","SUITE"])}</svg>`;
}

function security() {
  let screens = "";
  for (let r=0;r<2;r++) for (let c=0;c<5;c++) screens += `<rect x="${66+c*57}" y="${42+r*44}" width="48" height="34" rx="3" fill="#0b2b43" stroke="#3a8fc0"/><path d="M${70+c*57} ${63+r*44} l12 -10 12 7 13 -14" fill="none" stroke="#6ec9f2" stroke-width="2" opacity=".8"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300">${frameDefs("#c9a258","#254e68")}${roomBase(`<rect x="32" y="28" width="356" height="208" rx="8" fill="#07131b" stroke="#35687c"/>${screens}<path d="M62 168 Q210 130 358 168 L336 224 Q210 194 84 224 Z" fill="#11191d" stroke="#6d552d"/><circle cx="210" cy="195" r="26" fill="#202a2f" stroke="#8a6b37"/><rect x="185" y="236" width="50" height="56" fill="#5a210f" stroke="#df8137"/><ellipse cx="210" cy="244" rx="58" ry="36" fill="url(#lamp)"/>`)}${plaque(["SECURITY","OFFICE"])}</svg>`;
}

function laundry() {
  let washers="";
  for (let i=0;i<4;i++) washers += `<g transform="translate(${58+i*78} 56)"><rect width="62" height="88" rx="5" fill="#192126" stroke="#6f8790"/><circle cx="31" cy="49" r="22" fill="#071015" stroke="#8fa5aa" stroke-width="3"/><circle cx="31" cy="49" r="13" fill="#18313b"/><rect x="9" y="9" width="44" height="11" rx="2" fill="#0b1114" stroke="#5a6a70"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300">${frameDefs("#c89a48","#224453")}${roomBase(`<rect x="28" y="28" width="364" height="208" rx="8" fill="#0a1318" stroke="#4f6972"/>${washers}<path d="M36 190 H384 M36 207 H384" stroke="#3a4d53" stroke-width="8"/><path d="M50 26 V235 M372 26 V235" stroke="#6a7679" stroke-width="8" opacity=".5"/><rect x="185" y="236" width="50" height="56" fill="#5a210f" stroke="#df8137"/>`)}${plaque(["LAUNDRY","TUNNEL"])}</svg>`;
}

function atrium() {
  let rings="";
  [42,66,90,114].forEach((r,i)=>rings+=`<circle cx="210" cy="142" r="${r}" fill="none" stroke="${i%2?'#7aa2a0':'#c7a65a'}" stroke-opacity="${.34-i*.03}" stroke-width="${i===0?4:2}"/>`);
  let spokes="";
  for(let a=0;a<360;a+=20){const rad=a*Math.PI/180;spokes+=`<path d="M210 142 L${210+Math.cos(rad)*114} ${142+Math.sin(rad)*114}" stroke="#79918e" stroke-opacity=".20"/>`;}
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300">${frameDefs("#d6aa55","#1d4f50")}${roomBase(`<rect x="24" y="20" width="372" height="232" rx="116" fill="#091414" stroke="#8b733f" stroke-width="3"/><circle cx="210" cy="142" r="118" fill="#123132" opacity=".64"/>${rings}${spokes}<circle cx="210" cy="142" r="24" fill="#6f5b31" stroke="#d3aa5a" stroke-width="3"/><path d="M210 120 c-20 18 -18 42 0 54 c18 -12 20 -36 0 -54z" fill="#d5a94f"/><circle cx="210" cy="142" r="145" fill="none" stroke="#4a6b62" stroke-opacity=".32" stroke-width="12"/>`)}${plaque(["GLASS","ATRIUM"])}</svg>`;
}

function kitchen() {
  let burners="";for(let i=0;i<4;i++)burners+=`<circle cx="${94+i*58}" cy="77" r="13" fill="#0e1010" stroke="#a8a8a0"/><circle cx="${94+i*58}" cy="77" r="5" fill="#d26d22"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300">${frameDefs("#d2a04d","#73441a")}${roomBase(`<rect x="30" y="28" width="360" height="208" rx="8" fill="#121413" stroke="#70736b"/><rect x="54" y="48" width="270" height="58" rx="4" fill="#333632" stroke="#a7a79c"/>${burners}<rect x="82" y="136" width="256" height="64" rx="5" fill="#272a27" stroke="#8c8f87"/><path d="M110 152 H310 M110 169 H310 M110 186 H310" stroke="#b7b7ad" opacity=".28"/><path d="M350 50 V204" stroke="#6f532e" stroke-width="12"/><circle cx="350" cy="62" r="42" fill="url(#lamp)"/><rect x="185" y="236" width="50" height="56" fill="#5a210f" stroke="#df8137"/>`)}${plaque(["SERVICE","KITCHEN"])}</svg>`;
}

function garage() {
  const car=(x,y,fill)=>`<g transform="translate(${x} ${y})"><rect width="78" height="36" rx="12" fill="${fill}" stroke="#8a7b5f"/><rect x="18" y="5" width="42" height="16" rx="6" fill="#111820" stroke="#567083"/><circle cx="16" cy="36" r="7" fill="#050505"/><circle cx="62" cy="36" r="7" fill="#050505"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300">${frameDefs("#c89b4e","#533b1c")}${roomBase(`<rect x="28" y="28" width="364" height="208" rx="8" fill="#101212" stroke="#4d4d4b"/><path d="M52 44 V222 M124 44 V222 M196 44 V222 M268 44 V222 M340 44 V222" stroke="#c8c1a6" stroke-opacity=".16" stroke-width="3"/><path d="M50 206 H370" stroke="#d9cc9a" stroke-width="5" stroke-dasharray="16 15" opacity=".34"/>${car(72,70,"#2a2e30")}${car(250,62,"#3a3430")}${car(160,165,"#252b2f")}<path d="M210 214 l-28 -18 h19 v-24 h18 v24 h19z" fill="#b8a16b" opacity=".6"/>`)}${plaque(["PARKING","GARAGE"])}</svg>`;
}

function nightclub() {
  let tables="";[[80,85],[332,86],[100,192],[320,190]].forEach(([x,y],i)=>tables+=`<g><circle cx="${x}" cy="${y}" r="25" fill="#251226" stroke="#9b3d9d"/><circle cx="${x}" cy="${y}" r="8" fill="#ff64d8"/><circle cx="${x}" cy="${y}" r="42" fill="none" stroke="#59275e" stroke-opacity=".65"/></g>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300">${frameDefs("#d1a350","#8c1c78")}${roomBase(`<rect x="26" y="26" width="368" height="214" rx="8" fill="#130916" stroke="#613262"/>${tables}<rect x="150" y="48" width="120" height="58" rx="7" fill="#2b1333" stroke="#bd4fbe"/><path d="M160 66 H260 M160 82 H260" stroke="#ff7ae7" stroke-width="5" opacity=".65"/><path d="M58 220 H362" stroke="#76418a" stroke-width="12"/><circle cx="210" cy="208" r="80" fill="url(#lamp)" opacity=".22"/><circle cx="210" cy="130" r="78" fill="none" stroke="#5f2a79" stroke-width="10" stroke-dasharray="18 8"/>`)}${plaque(["BASEMENT","NIGHTCLUB"])}</svg>`;
}

function boiler() {
  let pipes="";[52,104,316,368].forEach((x)=>pipes+=`<path d="M${x} 34 V222" stroke="#80502a" stroke-width="14"/><path d="M${x} 34 V222" stroke="#d08b45" stroke-width="3" opacity=".5"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300">${frameDefs("#d09c46","#8d3b12")}${roomBase(`<rect x="28" y="28" width="364" height="208" rx="8" fill="#160d08" stroke="#6d492b"/>${pipes}<rect x="135" y="48" width="66" height="144" rx="28" fill="#302119" stroke="#a46633" stroke-width="4"/><rect x="220" y="62" width="72" height="132" rx="30" fill="#332116" stroke="#a46633" stroke-width="4"/><circle cx="168" cy="120" r="15" fill="#15100d" stroke="#e0a760" stroke-width="4"/><circle cx="256" cy="120" r="15" fill="#15100d" stroke="#e0a760" stroke-width="4"/><circle cx="210" cy="208" r="100" fill="url(#lamp)" opacity=".45"/><rect x="185" y="236" width="50" height="56" fill="#5a210f" stroke="#df8137"/>`)}${plaque(["BOILER","ROOM"])}</svg>`;
}

const ROOM_BUILDERS = { greenhouse, penthouse, security, laundry, atrium, kitchen, garage, nightclub, boiler };

const SUSPECT_META = {
  "mara-voss": { skin:"#c88f6e", hair:"#b98b54", coat:"#231b17", accent:"#d7b263", style:"waves" },
  "dex-vale": { skin:"#a56d50", hair:"#171311", coat:"#1c2327", accent:"#c89345", style:"beard" },
  "imani-cross": { skin:"#7e4b35", hair:"#17110f", coat:"#172329", accent:"#d3a55c", style:"curls" },
  "theo-rook": { skin:"#b98267", hair:"#c7c2b5", coat:"#2a2927", accent:"#caa15a", style:"silver" },
  "june-mercer": { skin:"#b7765f", hair:"#2b211b", coat:"#2d201a", accent:"#d08945", style:"hat" },
  "elias-flint": { skin:"#a66e52", hair:"#171310", coat:"#171c20", accent:"#c79b4f", style:"fedora" },
};

function suspectSvg(id) {
  const m = SUSPECT_META[id];
  const curls = m.style === "curls" ? `<g fill="#120d0c">${[[72,66],[90,52],[110,54],[132,62],[145,82],[66,88],[86,80],[108,78],[130,82]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="20"/>`).join("")}</g>` : "";
  const hair = m.style !== "curls" ? `<path d="M55 90 Q66 32 120 32 Q176 38 180 104 Q156 69 120 70 Q84 66 55 90Z" fill="${m.hair}"/>` : curls;
  const beard = ["beard","fedora"].includes(m.style) ? `<path d="M77 130 Q120 162 164 130 Q156 200 120 210 Q84 198 77 130Z" fill="#1a1412" opacity=".88"/>` : "";
  const hat = ["hat","fedora"].includes(m.style) ? `<path d="M48 68 Q120 18 192 68 L177 84 H63Z" fill="#151515" stroke="#6d5634" stroke-width="3"/><path d="M75 59 Q84 18 120 18 Q158 19 166 59Z" fill="#191919" stroke="#6d5634" stroke-width="3"/>` : "";
  const silver = m.style === "silver" ? `<path d="M58 82 Q68 28 120 34 Q169 36 181 86 Q152 57 119 62 Q84 58 58 82Z" fill="#bfb9aa"/><path d="M62 69 Q91 40 116 52 M136 48 Q155 55 174 76" stroke="#ece8de" stroke-width="5" opacity=".55"/>` : hair;
  const waves = m.style === "waves" ? `<path d="M55 86 Q55 35 108 29 Q171 27 184 96 Q174 149 157 182 Q156 106 145 83 Q118 66 92 78 Q73 112 82 183 Q57 146 55 86Z" fill="${m.hair}"/><path d="M72 72 Q94 48 116 59 M147 55 Q166 68 171 95" fill="none" stroke="#e0b87e" stroke-opacity=".35" stroke-width="7"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#121719"/><stop offset="1" stop-color="#020304"/></linearGradient><linearGradient id="rim"><stop stop-color="#f0cf87"/><stop offset="1" stop-color="${m.accent}"/></linearGradient><radialGradient id="light" cx=".25" cy=".2"><stop stop-color="#e9c786" stop-opacity=".38"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><rect width="240" height="320" fill="url(#b)"/><rect x="5" y="5" width="230" height="310" rx="12" fill="none" stroke="#6e5128" stroke-width="3"/><circle cx="70" cy="64" r="90" fill="url(#light)"/>${hat}${m.style==="silver"?silver:m.style==="waves"?waves:hair}<ellipse cx="120" cy="119" rx="54" ry="66" fill="${m.skin}"/><path d="M77 116 Q90 92 107 102 M133 102 Q152 91 165 116" fill="none" stroke="#4a2b20" stroke-width="5"/><ellipse cx="101" cy="120" rx="5" ry="4" fill="#17120f"/><ellipse cx="141" cy="120" rx="5" ry="4" fill="#17120f"/><path d="M119 122 q-7 25 5 29" fill="none" stroke="#7b4938" stroke-width="4"/><path d="M100 165 Q120 177 143 163" fill="none" stroke="#5a2d29" stroke-width="4"/>${beard}<rect x="102" y="177" width="36" height="42" rx="14" fill="${m.skin}"/><path d="M30 320 Q42 216 120 205 Q198 216 211 320Z" fill="${m.coat}"/><path d="M84 214 L120 262 L157 214" fill="#0d0e0f" stroke="#79613d" stroke-width="2"/><path d="M120 262 V316" stroke="url(#rim)" stroke-width="4" opacity=".45"/></svg>`;
}

function weaponSvg(id) {
  const icons = {
    "nail-gun": `<path d="M35 80 H145 L190 102 H140 L112 162 H78 L95 110 H35Z M145 80 L188 54 M111 162 L135 198"/>`,
    cleaver: `<path d="M58 42 H170 V148 H82 L58 126Z"/><circle cx="151" cy="63" r="8"/><path d="M88 148 L72 220" stroke-width="20"/>`,
    garrote: `<path d="M55 183 C75 55 172 55 195 183 M45 190 L72 225 M205 190 L178 225"/><rect x="25" y="176" width="46" height="22" rx="8"/><rect x="179" y="176" width="46" height="22" rx="8"/>`,
    revolver: `<path d="M34 83 H154 L200 104 H144 L119 131 H75 L58 116 H34Z"/><circle cx="112" cy="103" r="30"/><path d="M75 131 L58 210 L106 214 L127 132"/>`,
    poison: `<path d="M92 35 H147 V72 L171 101 V218 H68 V101 L92 72Z M92 55 H147 M99 125 L140 168 M140 125 L99 168"/><circle cx="105" cy="112" r="8" fill="#e2be72" stroke="none"/><circle cx="135" cy="112" r="8" fill="#e2be72" stroke="none"/>`,
    "fire-axe": `<path d="M151 48 L100 222" stroke-width="20"/><path d="M94 70 C150 41 202 43 224 80 C194 113 158 126 120 118Z"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 250"><defs><radialGradient id="g"><stop stop-color="#7d4a1d" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><rect width="250" height="250" rx="20" fill="#07090a"/><circle cx="125" cy="125" r="112" fill="url(#g)"/><g fill="none" stroke="#e5c47f" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">${icons[id]}</g><rect x="5" y="5" width="240" height="240" rx="18" fill="none" stroke="#5e4729" stroke-width="3"/></svg>`;
}

export const NOIR_ROOM_ART = Object.freeze(Object.fromEntries(Object.entries(ROOM_BUILDERS).map(([id, build]) => [id, svgData(build())])));
export const NOIR_SUSPECT_ART = Object.freeze(Object.fromEntries(Object.keys(SUSPECT_META).map((id) => [id, svgData(suspectSvg(id))])));
export const NOIR_WEAPON_ART = Object.freeze(Object.fromEntries(["nail-gun","cleaver","garrote","revolver","poison","fire-axe"].map((id) => [id, svgData(weaponSvg(id))])));

export const NOIR_ITEM_ASSETS = Object.freeze({
  rooms: NOIR_ROOM_ART,
  suspects: NOIR_SUSPECT_ART,
  weapons: NOIR_WEAPON_ART,
});
