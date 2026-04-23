let selectedIndex = null
let swapIndex = null

// ===== デッキ =====
function createDeck() {
  const deck = []
  for (let i = 1; i <= 6; i++) {
    for (let j = 1; j <= 6; j++) {
      const count = (i === j) ? 2 : 1
      for (let k = 0; k < count; k++) {
        deck.push({ top: i, bottom: j, faceUp: false })
      }
    }
  }
  return deck.sort(() => Math.random() - 0.5)
}

let deck = createDeck()
let hand = deck.splice(0, 6)
let field = deck

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
    drop.style.transform =
      `rotate(${angle + flip}deg) translate(0, -${radius}px)`

    container.appendChild(drop)
  }

  return container
}

// ===== 回転 =====
function rotateCard(i) {
  ;[hand[i].top, hand[i].bottom] = [hand[i].bottom, hand[i].top]
  render()
}

// ===== 牌 =====
function createCard(card, i, isField) {
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
    div.style.left = Math.random() * 800 + "px"
    div.style.top = Math.random() * 400 + "px"
    div.style.transform = `rotate(${Math.random()*20-10}deg)`
    div.onclick = () => take(i)
  } else {
    div.onclick = () => {
      if (swapIndex === null) {
        swapIndex = i
      } else {
        ;[hand[swapIndex], hand[i]] = [hand[i], hand[swapIndex]]
        swapIndex = null
      }

      selectedIndex = i
      document.getElementById("discardBtn").style.display = "flex"
      render()
    }

    div.oncontextmenu = (e) => {
      e.preventDefault()
      rotateCard(i)
    }

    if (selectedIndex === i) div.style.border = "3px solid red"
    if (swapIndex === i) div.style.border = "3px solid blue"
  }

  return div
}

// ===== 描画 =====
function render() {
  const f = document.getElementById("field")
  const h = document.getElementById("hand")

  f.innerHTML = ""
  h.innerHTML = ""

  field.forEach((c, i) => f.appendChild(createCard(c, i, true)))
  hand.forEach((c, i) => h.appendChild(createCard(c, i, false)))

  document.getElementById("roleDisplay").innerText = getRole(hand)
}

// ===== 取る =====
function take(i) {
  if (hand.length >= 6) return alert("先に捨てて！")
  const c = field.splice(i, 1)[0]
  c.faceUp = true
  hand.push(c)
  render()
}

// ===== 捨てる =====
document.getElementById("discardBtn").onclick = () => {
  if (hand.length <= 5) return alert("手札は5枚必要！")

  const c = hand.splice(selectedIndex, 1)[0]
  c.faceUp = true
  field.push(c)

  selectedIndex = null
  swapIndex = null
  document.getElementById("discardBtn").style.display = "none"

  render()
}

render()
