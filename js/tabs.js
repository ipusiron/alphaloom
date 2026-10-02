// タブの切り替え（WAI-ARIA のタブのパターン）。クリック、左右の矢印キー、Home・End で移る。
// 選ばれていないタブは tabindex=-1 にして、Tab キーではパネルへ進めるようにする

export function initTabs(nav, onChange = () => {}) {
  const tabs = [...nav.querySelectorAll('[role="tab"]')];
  const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));

  function select(tab, focus = false) {
    for (const other of tabs) {
      const on = other === tab;
      other.setAttribute('aria-selected', String(on));
      other.tabIndex = on ? 0 : -1;
      other.classList.toggle('active', on);
      panelOf(other).hidden = !on;
    }
    if (focus) tab.focus();
    onChange(tab.dataset.tab);
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(tab);
      let next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (!next) return;
      e.preventDefault();
      select(next, true);
    });
  }
  const initial = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
  select(initial);
  return { select: (name) => select(tabs.find((t) => t.dataset.tab === name) || tabs[0]) };
}
