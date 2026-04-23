function testRole(type){
  let h=[]

  if(type==="rikka"){
    for(let i=1;i<=6;i++)h.push({top:i,bottom:3,faceUp:true})
  }

  if(type==="sanren"){
    h=[
      {top:1,bottom:2,faceUp:true},
      {top:2,bottom:2,faceUp:true},
      {top:3,bottom:2,faceUp:true},
      {top:4,bottom:5,faceUp:true},
      {top:5,bottom:5,faceUp:true},
      {top:6,bottom:5,faceUp:true},
    ]
  }

  if(type==="isshiki"){
    h=[
      {top:1,bottom:4,faceUp:true},
      {top:3,bottom:4,faceUp:true},
      {top:5,bottom:4,faceUp:true},
      {top:2,bottom:4,faceUp:true},
      {top:6,bottom:4,faceUp:true},
      {top:4,bottom:4,faceUp:true},
    ]
  }

  hand=h
  render()
}
