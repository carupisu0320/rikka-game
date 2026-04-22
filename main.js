let hand = []
let field = []

function createDeck() {
  const deck = []

  for (let top = 1; top <= 6; top++) {
    for (let bottom = 1; bottom <= 6; bottom++) {

      deck.push({ top, bottom })

      if (top === bottom) {
        deck.push({ top, bottom })
      }
    }
  }

  return deck.sort(() => Math.random() - 0.5)
}

function init() {
  const deck = createDeck()

  hand = deck.splice(0, 5)

  field = deck.map((card, i) => ({
    ...card,
    x: (i % 7) * 13 + 5,
    y: Math.floor(i / 7) * 45 + 10,
    r: Math.random() * 30 - 15,
    faceUp: false
  }))

  render()
}

function createCard(card, isField = false, index = 0) {
  const div = document.createElement("div")
  div.className = "card"

  if (!card.faceUp && isField) {
    div.classList.add("back")
  } else {
    div.innerHTML = `
      <div>${card.top}</div>
      <div>${card.bottom}</div>
    `
  }

  // 回転（向きバラバラ）
  if (isField) {
    div.style.transform = `rotate(${card.r}deg)`
    div.style.left = card.x + "%"
    div.style.top = card.y + "px"
    div.onclick = () => takeFromField(index)
  } else {
    div.onclick = () => discard(index)
  }

  return div
}

function render() {
  const handDiv = document.getElementById("hand")
  const fieldDiv = document.getElementById("field")

  handDiv.innerHTML = ""
  fieldDiv.innerHTML = ""

  hand.forEach((card, index) => {
    handDiv.appendChild(createCard(card, false, index))
  })

  field.forEach((card, index) => {
    fieldDiv.appendChild(createCard(card, true, index))
  })
}

function takeFromField(index) {
  if (hand.length >= 6) {
    alert("先に1枚捨てて！")
    return
  }

  const card = field.splice(index, 1)[0]
  hand.push(card)
  render()
}

function discard(index) {
  if (hand.length <= 5) {
    alert("まだ捨てられない！")
    return
  }

  const card = hand.splice(index, 1)[0]

  card.faceUp = true
  card.r = Math.random() * 30 - 15

  // 空いてる場所に戻す（ズレない）
  card.x = Math.random() * 80
  card.y = Math.random() * 200

  field.push(card)
  render()
}

init()
