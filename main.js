// ===== デッキ（42枚）=====
function createDeck() {
  const deck = []

  for (let i = 1; i <= 6; i++) {
    for (let j = 1; j <= 6; j++) {
      const count = (i === j) ? 2 : 1

      for (let k = 0; k < count; k++) {
        deck.push({
          top: i,
          bottom: j,
          faceUp: false
        })
      }
    }
  }

  return deck.sort(() => Math.random() - 0.5)
}

// ===== 初期 =====
let deck = createDeck()
let hand = deck.splice(0, 6)
let field = deck

// ===== 模様（中央に向かう綺麗版）=====
function createSymbol(num, isTop) {
  const container = document.createElement("div")
  container.style.position = "relative"
  container.style.width = "40px"
  container.style.height = "30px"

  const colors = {
    1: "red",
    2: "orange",
    3: "gold",
    4: "limegreen",
    5: "deepskyblue",
    6: "hotpink"
  }

  // ●
  if (num === 1) {
    const dot = document.createElement("div")
    dot.style.width = "10px"
    dot.style.height = "10px"
    dot.style.borderRadius = "50%"
    dot.style.background = colors[num]
    dot.style.position = "absolute"
    dot.style.left = "50%"
    dot.style.top = "50%"
    dot.style.transform = "translate(-50%, -50%)"
    container.appendChild(dot)
    return container
  }

  // 涙（中心に向かう）
  for (let i = 0; i < num; i++) {
    const drop = document.createElement("div")

    const angle = (360 / num) * i
    const radius = 10
    const flip = isTop ? 180 : 0

    drop.style.width = "10px"
    drop.style.height = "14px"
    drop.style.background = colors[num]
    drop.style.borderRadius = "50% 50% 50% 0"
    drop.style.position = "absolute"

    drop.style.left = "50%"
    drop.style.top = "50%"
    drop.style.transform = `
      rotate(${angle + flip}deg)
      translate(0, -${radius}px)
    `

    container.appendChild(drop)
  }

  return container
}

// ===== 牌 =====
function createCard(card, index, isField) {
  const div = document.createElement("div")
  div.className = isField ? "card" : "card hand-card"

  if (!card.faceUp && isField) {
    div.classList.add("back")
  } else {
    // 上（そのまま）
    const topArea = document.createElement("div")
    topArea.style.display = "flex"
    topArea.style.justifyContent = "center"
    topArea.appendChild(createSymbol(card.top, true))

    // 真ん中
    const middle = document.createElement("div")
    middle.style.textAlign = "center"
    middle.style.height = "20px"

    if (card.top === card.bottom) {
      middle.innerText = "★"
      middle.style.fontSize = "18px"
    }

    // 下（-6px 上げる）
    const bottomArea = document.createElement("div")
    bottomArea.style.display = "flex"
    bottomArea.style.justifyContent = "center"
    bottomArea.style.transform = "translateY(-6px)"

    bottomArea.appendChild(createSymbol(card.bottom, false))

    div.appendChild(topArea)
    div.appendChild(middle)
    div.appendChild(bottomArea)
  }

  if (isField) {
    const fieldWidth = 800
    const cols = 9

    const gapX = fieldWidth / cols
    const gapY = 100

    const col = index % cols
    const row = Math.floor(index / cols)

    const x = col * gapX + Math.random() * 20 - 10
    const y = row * gapY + 20 + Math.random() * 15 - 7

    div.style.left = x + "px"
    div.style.top = y + "px"

    div.style.transform = `rotate(${Math.random() * 20 - 10}deg)`

    div.onclick = () => take(index)
  } else {
    div.onclick = () => discard(index)
  }

  return div
}

// ===== 描画 =====
function render() {
  const fieldDiv = document.getElementById("field")
  const handDiv = document.getElementById("hand")

  fieldDiv.innerHTML = ""
  handDiv.innerHTML = ""

  field.forEach((card, i) => {
    fieldDiv.appendChild(createCard(card, i, true))
  })

  hand.forEach((card, i) => {
    handDiv.appendChild(createCard(card, i, false))
  })
}

// ===== 操作 =====
function take(index) {
  if (hand.length >= 6) {
    alert("先に1枚捨てて！")
    return
  }

  const card = field.splice(index, 1)[0]
  card.faceUp = true
  hand.push(card)

  render()
}

function discard(index) {
  const card = hand.splice(index, 1)[0]
  card.faceUp = true
  field.push(card)

  render()
}

// ===== 開始 =====
render()
