// ===== テスト用手札 =====

// 一色
function setIsshiki() {
  hand = [
    {top:1,bottom:2,faceUp:true},
    {top:3,bottom:2,faceUp:true},
    {top:4,bottom:2,faceUp:true},
    {top:5,bottom:2,faceUp:true},
    {top:6,bottom:2,faceUp:true},
    {top:2,bottom:2,faceUp:true}
  ]
  render()
}

// 三連
function setSanren() {
  hand = [
    {top:1,bottom:3,faceUp:true},
    {top:2,bottom:3,faceUp:true},
    {top:3,bottom:3,faceUp:true},

    {top:4,bottom:5,faceUp:true},
    {top:5,bottom:5,faceUp:true},
    {top:6,bottom:5,faceUp:true}
  ]
  render()
}

// 六華
function setRikka() {
  hand = [
    {top:1,bottom:4,faceUp:true},
    {top:2,bottom:4,faceUp:true},
    {top:3,bottom:4,faceUp:true},
    {top:4,bottom:4,faceUp:true},
    {top:5,bottom:4,faceUp:true},
    {top:6,bottom:4,faceUp:true}
  ]
  render()
}
