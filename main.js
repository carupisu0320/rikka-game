let hand = [
  { top: 1, bottom: 2 },
  { top: 3, bottom: 4 },
  { top: 5, bottom: 6 },
  { top: 2, bottom: 2 },
  { top: 6, bottom: 1 }
]

let field = []

function render() {
  const handDiv = document.getElementById("hand")
  const fieldDiv = document.getElementById("field")

  handDiv.innerHTML = "<h2>手札</h2>"
  fieldDiv.innerHTML = "<h2>場</h2>"

  hand.forEach((card, index) => {
    const div = document.createElement("div")
    div.innerText = `${card.top}-${card.bottom}`
    div.onclick = () => discard(index)
    handDiv.appendChild(div)
  })

  field.forEach(card => {
    const div = document.createElement("div")
    div.innerText = `${card.top}-${card.bottom}`
    fieldDiv.appendChild(div)
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

function draw() {
  const newCard = {
    top: Math.ceil(Math.random() * 6),
    bottom: Math.ceil(Math.random() * 6)
  }

  hand.push(newCard)
  render()
}

function discard(index) {
  const card = hand.splice(index, 1)[0]
  field.push(card)
  render()
}

render()
