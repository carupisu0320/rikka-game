// ===== 共通 =====
function isSame(arr) {
  return arr.every(v => v === arr[0])
}

function isSequence(arr) {
  const sorted = [...arr].sort((a, b) => a - b)
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i] + 1 !== sorted[i + 1]) return false
  }
  return true
}

// ===== 回転パターン =====
function getAllPatterns(hand) {
  const results = []

  function dfs(index, current) {
    if (index === hand.length) {
      results.push(current)
      return
    }

    const card = hand[index]

    dfs(index + 1, [...current, card])

    dfs(index + 1, [...current, {
      top: card.bottom,
      bottom: card.top
    }])
  }

  dfs(0, [])
  return results
}

// ===== 三連 =====
function combinations(arr, k) {
  const result = []

  function helper(start, comb) {
    if (comb.length === k) {
      result.push([...comb])
      return
    }

    for (let i = start; i < arr.length; i++) {
      comb.push(arr[i])
      helper(i + 1, comb)
      comb.pop()
    }
  }

  helper(0, [])
  return result
}

function isSanSet(group) {
  const bottoms = group.map(c => c.bottom)
  const tops = group.map(c => c.top)
  return isSame(bottoms) && isSequence(tops)
}

function checkSanren(hand) {
  const comb = combinations(hand, 3)

  for (const g1 of comb) {
    const g2 = hand.filter(c => !g1.includes(c))

    if (isSanSet(g1) && isSanSet(g2)) {
      return true
    }
  }

  return false
}

// ===== 役 =====
function getRole(hand) {
  const patterns = getAllPatterns(hand)

  for (const h of patterns) {
    const bottoms = h.map(c => c.bottom)
    const tops = h.map(c => c.top)

    if (isSame(bottoms) && isSequence(tops) && tops.length === 6) {
      return { name: "六華", point: 6 }
    }

    if (checkSanren(h)) {
      return { name: "三連", point: 3 }
    }

    if (isSame(bottoms)) {
      return { name: "一色", point: 1 }
    }
  }

  return null
}
