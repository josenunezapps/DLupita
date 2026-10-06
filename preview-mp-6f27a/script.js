const observer = new IntersectionObserver((entries)=>{
  entries.forEach((entry)=>{
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
},{threshold:0.12});

document.querySelectorAll('.reveal').forEach((el)=>observer.observe(el));

const header = document.querySelector('.site-header');
window.addEventListener('scroll',()=>{
  const y = window.scrollY;
  header.style.background = y > 60 ? 'rgba(17,14,12,.88)' : 'transparent';
  header.style.backdropFilter = y > 60 ? 'blur(14px)' : 'none';
});