(function($) {
  "use strict"; // Start of use strict

  // Smooth scrolling using jQuery easing
  $('a.js-scroll-trigger[href*="#"]:not([href="#"])').click(function() {
    if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
      var target = $(this.hash);
      target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
      if (target.length) {
        $('html, body').animate({
          scrollTop: (target.offset().top - 72)
        }, 1000, "easeInOutExpo");
        return false;
      }
    }
  });

  // Closes responsive menu when a scroll trigger link is clicked
  $('.js-scroll-trigger').click(function() {
    $('.navbar-collapse').collapse('hide');
  });

  // Activate scrollspy to add active class to navbar items on scroll
  $('body').scrollspy({
    target: '#mainNav',
    offset: 75
  });

  // Collapse Navbar
  var navbarCollapse = function() {
    if ($("#mainNav").offset().top > 100) {
      $("#mainNav").addClass("navbar-scrolled");
    } else {
      $("#mainNav").removeClass("navbar-scrolled");
    }
  };
  // Collapse now if page is not at top
  navbarCollapse();
  // Collapse the navbar when page is scrolled
  $(window).scroll(navbarCollapse);

  $('main h2').fadeIn(1000);
  $('main .lead').delay(1500).fadeIn(1500);
  $('main form').delay(4500).fadeIn(800);
  $('main form #address').change(function(e){
    $('main form').removeClass('was-validated');
    let addressEl = document.getElementById('address');
    addressEl.setCustomValidity('');
  });
  $('main form').submit(function(e){
    console.log('submit')
    e.preventDefault();
    e.stopPropagation();
    if (this.checkValidity() === false) {
          // e.preventDefault();
          // e.stopPropagation();
    }
    else {
      let accountRegEx = new RegExp('^desmos1[a-z0-9]{38}$', 'gm');

      let addressEl = document.getElementById('address');

      console.log(addressEl.value);
      if (addressEl.value.match(accountRegEx)){
        console.log('valid');
        // addressEl.setCustomValidity('');
        $('main form .from-input').hide();
        $('main form div.loader').addClass('d-flex').show();
      }
      else{
        console.log('invalid');
        addressEl.setCustomValidity('The address is not a valid Desmos address.');
      }
      
    }
    $(this).addClass('was-validated');
    // console.log()
  });
})(jQuery); // End of use strict
