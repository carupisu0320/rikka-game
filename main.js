// ===== デッキ作成 =====
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

// ===== ゲーム状態 =====
let deck = createDeck()
let hand = deck.splice(0, 6)
let field = deck

// ===== 模様作成 =====
function createSymbol(num) {
  const container = document.createElement("div")
  container.style.display = "flex"
  container.style.flexWrap = "wrap"
  container.style.justifyContent = "center"

  const colors = {
    1: "red",
    2: "orange",
    3: "gold",
    4: "limegreen",
    5: "deepskyblue",
    6: "hotpink"
  }

  if (num === 1) {
    const dot = document.createElement("div")
    dot.style.width = "10px"
    dot.style.height = "10px"
    dot.style.borderRadius = "50%"
    dot.style.background = colors[num]
    container.appendChild(dot)
    return container
  }

  for (let i = 0; i < num; i++) {
    const drop = document.createElement("div")
    drop.style.width = "8px"
    drop.style.height = "12px"
    drop.style.background = colors[num]
    drop.style.borderRadius = "50% 50% 50% 0"
    drop.style.transform = `rotate(${i * (360 / num)}deg)`
    drop.style.margin = "1px"
    container.appendChild(drop)
  }

  return container
}

// ===== 牌作成 =====
function createCard(card, index, isField) {
  const div = document.createElement("div")
  div.className = isField ? "card" : "card hand-card"

  if (!card.faceUp && isField) {
    div.style.background = "gray"
  } else {
    const top = createSymbol(card.top)
    const bottom = createSymbol(card.bottom)

    const middle = document.createElement("div")

    if (card.top === card.bottom) {
      middle.innerText = "★"
    }

    div.appendChild(top)
    div.appendChild(middle)
    div.appendChild(bottom)
  }

  if (isField) {
    // 重ならない配置（グリッド）
    const cols = 8
    const x = (index % cols) * 70
    const y = Math.floor(index / cols) * 110

    div.style.left = x + "px"
    div.style.top = y + "px"

    // 向きバラバラ
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

// ===== 行動 =====
function take(index) {
  if (hand.length >= 6) {
    alert("手札は6枚まで！")
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

function draw() {
  alert("場から取ってね")
}

// ===== 初期表示 =====
render()
