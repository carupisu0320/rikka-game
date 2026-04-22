let hand = []
let field = []

// デッキ作成
function createDeck() {
  const deck = []
  for (let top = 1; top <= 6; top++) {
    for (let bottom = 1; bottom <= 6; bottom++) {
      deck.push({ top, bottom })
    }
  }
  return deck.sort(() => Math.random() - 0.5)
}

// 初期化
function init() {
  const deck = createDeck()

  hand = deck.splice(0, 5)

  field = deck.map(card => ({
    ...card,
    x: Math.random() * 80,
    y: Math.random() * 200
  }))

  render()
}

// 描画
function render() {
  const handDiv = document.getElementById("hand")
  const fieldDiv = document.getElementById("field")

  handDiv.innerHTML = ""
  fieldDiv.innerHTML = ""

  // 手札
  hand.forEach((card, index) => {
    const img = document.createElement("img")
    img.src = `images/${card.top}-${card.bottom}.png`

    img.onclick = () => discard(index)

    handDiv.appendChild(img)
  })

  // 場
  field.forEach((card, index) => {
    const img = document.createElement("img")
    img.src = `images/${card.top}-${card.bottom}.png`

    img.style.left = card.x + "%"
    img.style.top = card.y + "px"

    img.onclick = () => takeFromField(index)

    fieldDiv.appendChild(img)
  })
}

// 場から取る
function takeFromField(index) {
  if (hand.length >= 6) {
    alert("先に1枚捨てて！")
    return
  }

  const card = field.splice(index, 1)[0]
  hand.push(card)
  render()
}

// 捨てる
function discard(index) {
  if (hand.length <= 5) {
    alert("まだ捨てられない！")
    return
  }

  const card = hand.splice(index, 1)[0]

  card.x = Math.random() * 80
  card.y = Math.random() * 200

  field.push(card)
  render()
}

// スタート
init()
