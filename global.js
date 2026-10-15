console.log('IT’S ALIVE!');


function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// let currentLink = navLinks.find(
//     (a) => a.host === location.host && a.pathname === location.pathname,
//   );

// if (currentLink) {
//     currentLink.classList.add('current');
// }

let pages = [
    { url: '', title: 'Home' },
    { url: 'projects/', title: 'Projects' },
    { url: 'cv/', title: 'CV' },
    { url: 'contact/', title: 'Contact' },
    { url: 'https://github.com/moza-ucsd', title: 'GitHub' },
  ];
   
  const BASE_PATH =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? '/' // Local server
    : '/portfolio/'; // GitHub Pages repo name
 
let nav = document.createElement('nav');
document.body.prepend(nav);
 
for (let p of pages) {
  let url = p.url;
  let title = p.title;
 
  url = !url.startsWith('http') ? BASE_PATH + url : url;
 
  let a = document.createElement('a');
  a.href = url;
  a.textContent = title;

  a.classList.toggle(
    'current',
    a.host === location.host && a.pathname === location.pathname,
  );

  if (a.host !== location.host) {
    a.target = '_blank';
  }
 
  nav.append(a);
}
 
document.body.insertAdjacentHTML(
  'afterbegin',
  `
  <label class="color-scheme">
    Theme:
    <select>
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>`,
);
 
let select = document.querySelector('.color-scheme select');
 
function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty('color-scheme', colorScheme);
  select.value = colorScheme;
}
 
select.addEventListener('input', function (event) {
  console.log('color scheme changed to', event.target.value);
  setColorScheme(event.target.value);
  localStorage.colorScheme = event.target.value;
});
 
if ('colorScheme' in localStorage) {
  setColorScheme(localStorage.colorScheme);
}
 
let form = document.querySelector('form');
 
form?.addEventListener('submit', function (event) {
  event.preventDefault();
 
  let data = new FormData(form);
  let params = [];
 
  for (let [name, value] of data) {
    if (name === 'email') continue;
    params.push(`${name}=${encodeURIComponent(value)}`);
    console.log(name, encodeURIComponent(value));
  }
 
  let url = form.action + '?' + params.join('&');
  location.href = url;
});
