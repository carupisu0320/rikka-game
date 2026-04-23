let selectedIndex = null
let swapIndex = null

// デッキ
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

// 模様
function createSymbol(num) {
  const div = document.createElement("div")
  div.innerText = num
  return div
}

// 回転
function rotateCard(i) {
  [hand[i].top, hand[i].bottom] = [hand[i].bottom, hand[i].top]
  render()
}

// 牌
function createCard(card, i, isField) {
  const div = document.createElement("div")
  div.className = isField ? "card" : "card hand-card"

  if (!card.faceUp && isField) {
    div.classList.add("back")
  } else {
    div.innerHTML = `
      <div style="text-align:center">${card.top}</div>
      <div style="text-align:center">${card.top === card.bottom ? "★" : ""}</div>
      <div style="text-align:center; transform:translateY(-6px)">${card.bottom}</div>
    `
  }

  if (isField) {
    div.style.left = Math.random() * 800 + "px"
    div.style.top = Math.random() * 400 + "px"
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

// 描画
function render() {
  const f = document.getElementById("field")
  const h = document.getElementById("hand")

  f.innerHTML = ""
  h.innerHTML = ""

  field.forEach((c, i) => f.appendChild(createCard(c, i, true)))
  hand.forEach((c, i) => h.appendChild(createCard(c, i, false)))

  // 役表示（自動）
  document.getElementById("roleDisplay").innerText = getRole(hand)
}

// 取る
function take(i) {
  if (hand.length >= 6) return alert("先に捨てて！")
  const c = field.splice(i, 1)[0]
  c.faceUp = true
  hand.push(c)
  render()
}

// 捨てる
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
