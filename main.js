let hand = [
  { top: 1, bottom: 1 },
  { top: 2, bottom: 3 },
  { top: 4, bottom: 5 },
  { top: 6, bottom: 2 },
  { top: 3, bottom: 1 }
]

let field = []

function render() {
  const handDiv = document.getElementById("hand")
  const fieldDiv = document.getElementById("field")

  handDiv.innerHTML = ""
  fieldDiv.innerHTML = ""

  // 手札
  hand.forEach((card, index) => {
    const img = document.createElement("img")
    img.src = `images/${card.top}-${card.bottom}.png`
    img.style.width = "70px"
    img.style.margin = "5px"

    img.onclick = () => discard(index)

    handDiv.appendChild(img)
  })

  // 場
  field.forEach(card => {
    const img = document.createElement("img")
    img.src = `images/${card.top}-${card.bottom}.png`
    img.style.width = "70px"
    img.style.margin = "5px"

    fieldDiv.appendChild(img)
  })
}

function draw() {
  if (hand.length >= 6) {
    alert("もうこれ以上持てないよ！")
    return
  }

  const newCard = {
    top: Math.ceil(Math.random() * 6),
    bottom: Math.ceil(Math.random() * 6)
  }

  hand.push(newCard)
  render()
}

function discard(index) {
  if (hand.length <= 5) {
    alert("まだ捨てられない！")
    return
  }

  const card = hand.splice(index, 1)[0]
  field.push(card)
  render()
}

// 初回表示
render()
