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
	{url: "", title: "Home"},
	{url: "projects/", title: "Projects"},
	{url: "cv/", title: "CV"},
	{url: "contact/", title: "Contact"},
	{url: "https://github.com/moza-ucsd", title: "GitHub"},
];

let nav = document.createElement('nav');
document.body.prepend(nav);

const ARE_WE_HOME = document.documentElement.classList.contains("home");

for (let p of pages) {
	let url = p.url;
	let title = p.title;
	let a = document.createElement("a");

	a.textContent = title;
	
	url = ARE_WE_HOME || url.startsWith("http") ? url : "../" + url;
	a.href = url;

	if (a.host !== location.host) {
		a.target = "_blank";
	}
	else {
		// Local link
		if (a.pathname === location.pathname) {
			a.classList.add("current");
		}
	}

	nav.appendChild(a);
}
