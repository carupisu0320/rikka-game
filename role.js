function isSame(a){return a.every(v=>v===a[0])}
function isSequence(a){a=[...a].sort((x,y)=>x-y);return a.every((v,i)=>!i||a[i-1]+1===v)}

function isRikka(h){return h.length===6&&isSame(h.map(c=>c.bottom))&&isSequence(h.map(c=>c.top))}

function combinations(a,k){
  const r=[]
  function f(s,c){
    if(c.length===k)return r.push([...c])
    for(let i=s;i<a.length;i++){c.push(a[i]);f(i+1,c);c.pop()}
  }
  f(0,[])
  return r
}

function isSanSet(g){
  return isSame(g.map(c=>c.bottom))&&isSequence(g.map(c=>c.top))
}

function isSanren(h){
  return combinations(h,3).some(g=>{
    const g2=h.filter(c=>!g.includes(c))
    return isSanSet(g)&&isSanSet(g2)
  })
}

function isIsshiki(h){
  return isSame(h.map(c=>c.bottom))
}

function getRole(h){
  if(isRikka(h))return "六華"
  if(isSanren(h))return "三連"
  if(isIsshiki(h))return "一色"
  return ""
}
