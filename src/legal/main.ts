import '../styles/main.css'
import './styles.css'

const year = String(new Date().getFullYear())
for (const id of ['year', 'year-foot']) {
  const el = document.getElementById(id)
  if (el) el.textContent = year
}

if (location.hash) {
  const target = document.querySelector(location.hash)
  target?.scrollIntoView({ block: 'start' })
}
