// ===== デッキ =====
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

let selectedIndex = null // 捨てる用
let swapIndex = null     // 並び替え用

// ===== 模様 =====
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

// ===== 回転 =====
function rotateCard(index) {
  const card = hand[index]
  ;[card.top, card.bottom] = [card.bottom, card.top]
  render()
}

// ===== 牌 =====
function createCard(card, index, isField) {
  const div = document.createElement("div")
  div.className = isField ? "card" : "card hand-card"

  if (!card.faceUp && isField) {
    div.classList.add("back")
  } else {
    const topArea = document.createElement("div")
    topArea.style.display = "flex"
    topArea.style.justifyContent = "center"
    topArea.appendChild(createSymbol(card.top, true))

    const middle = document.createElement("div")
    middle.style.textAlign = "center"
    middle.style.height = "20px"

    if (card.top === card.bottom) {
      middle.innerText = "★"
      middle.style.fontSize = "18px"
    }

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

    div.style.left = col * gapX + Math.random() * 20 - 10 + "px"
    div.style.top = row * gapY + 20 + Math.random() * 15 - 7 + "px"
    div.style.transform = `rotate(${Math.random() * 20 - 10}deg)`

    div.onclick = () => take(index)

  } else {
    div.onclick = () => {
      // 並び替え
      if (swapIndex === null) {
        swapIndex = index
      } else {
        const temp = hand[swapIndex]
        hand[swapIndex] = hand[index]
        hand[index] = temp
        swapIndex = null
      }

      // 捨てる用選択
      selectedIndex = index
      showDiscardButton()
      render()
    }

    // 回転
    div.oncontextmenu = (e) => {
      e.preventDefault()
      rotateCard(index)
    }

    // 赤（捨てる）
    if (selectedIndex === index) {
      div.style.border = "3px solid red"
    }

    // 青（並び替え）
    if (swapIndex === index) {
      div.style.border = "3px solid blue"
    }
  }

  return div
}

// ===== ボタン =====
function showDiscardButton() {
  const btn = document.getElementById("discardBtn")
  btn.style.display = "inline-block"
}

function discardSelected() {
  if (selectedIndex === null) return

  if (hand.length <= 5) {
    alert("手札は5枚必要！")
    return
  }

  const card = hand.splice(selectedIndex, 1)[0]
  card.faceUp = true
  field.push(card)

  selectedIndex = null
  swapIndex = null
  document.getElementById("discardBtn").style.display = "none"

  render()
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

// ===== 取る =====
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

// ===== ボタン処理 =====
document.getElementById("discardBtn").onclick = discardSelected

// ===== 開始 =====
render()
