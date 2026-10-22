let langfiltershown = false;
let ltcountdowns = [];
let category = categoryname;
let buyurlcourse = '';
let hasbreadcrumbs = 0;
let mocktestblocktitle = '';
$(document).ready(function() {
    if($(window).width() < 991){
        if(coursename != 'dashboard'){
            $(".btn-buy-nw").text("Buy");
        }
    }
    if ($('#openFilterBtn').length) {
        $('#openFilterBtn').css('top', $('.hdr-main').outerHeight() + 5);
    }
    $('.tabs-wrapper').css('top',$('.hdr-main').outerHeight());
    $('.sm-nav-container').css('top',$('.hdr-main').outerHeight());

    var headerHeight = $('.hdr-main').outerHeight();
    $('.fltr-lang-btn').each(function () {
        var lang = $(this).data('language'); // English / Hinglish
        if ((lang != "All") && ($('.lang-' + lang).length === 0)) {
            $(".fltr-nav-wrapper").hide();
        }
    });

    new countdown(diffSeconds, 'wexptimer');
    $('.allsections').each(function() {
        observer.observe(this);
    });

    if($(".fltr-tabs-row").length > 0){
        $(".fltr-tabs-row").css("top", headerHeight);
        updateFilterIndicator();
        updateArrows(); 
        $('.fltr-tabs-row').on('scroll', function () {
            updateArrows();
        });
    }
    $.get("content.php", {"c": coursename, "i": categoryname}, function(data){
        data = JSON.parse(data);
        buyurlcourse = data.buyurlcourse;
        if ((buyurlcourse == '') || (buyurlcourse == undefined)){
            buyurlcourse = data.buyurl;
        }
        if((buyurlcourse != '') && (buyurlcourse != undefined)){
            $(".btn-upgrade").attr("onclick", "window.open('" + buyurlcourse + "', '_blank');");
        }
        /*
            $(".hdr-promo-banner").attr("onclick", "window.open('" + buyurlcourse + "', '_blank');");
            $(".btn-buy-nw").attr("onclick", "window.open('" + buyurlcourse + "', '_blank');");
        }*/

        if(data.title_txt.includes('Bookmarks')){
            data.title_txt = 'Bookmarks';
        }
        if(data.title_txt.includes('Pyp')){
            data.title_txt = 'PYPs';
        }
        let document_title = "Oliveboard | " + data.categorytitle + " " + data.title_txt;
        if (data.categorytitle == null){
            document_title = "Oliveboard | " + data.title_txt;
        }
        document_title = document_title.replace('&amp;','&');
        document.title = document_title;
        
        make_menu(data);
        make_fmdoverlay(data);
        let htm = '';
        htm += gen_horizontalmenu(data);
        $(".main-wrapper").prepend(htm);
        if (data.tabdata.length > 6){
            $('.scroll-arrow').show();
        }
        htm = '';
        htm += gen_hdr_brand_area(data);
        $(".hdr-brand-area").html(htm);
        htm = '';
        htm += gen_breadcrumbs(data);
        $(htm).insertAfter(".hdr-brand-area");
        htm = '';
        htm += gen_blocks(data);
        $(".crs-main-wrapper").html(htm);
        $('#mocktestblocktitle').text(mocktestblocktitle);

        numview = $(".tpc-view-all").data("numview") || 20;
        showTopCards(numview);

        htm = '';
        htm += gen_categorymodalbox(data);
        $("body").append(htm);
        if(ltcountdowns.length > 0){
            setupcountdowns();
        }
        if ($("div.lmm-carousel-controls").length > 0){
            setInterval(function() {
                goToSlide(currentIndex + 1);
            }, 5000); // Change slide every 5 seconds
        }
        hideunusedviewall();
        if(hasbreadcrumbs && window.innerWidth < 500){
            $('.mob-search').hide();
            $('.mic_logo').remove();
        }

        if((categoryname == "")&&(data.categoryname != undefined)){
            categoryname = data.categoryname;
        }
        seturlparams(`?c=${coursename}&i=${categoryname}`);
        setCookie("lcatv", categoryname, 365);

        if((coursename == "videolessons") && (tags.length > 0)){
                var tagsstr = tags.join(",");
                seturlparams(`?c=${coursename}&i=${categoryname}&tags=${tagsstr}`);
                $.each(tags, function(tagindx, tagval){
                    $("." + tagval).show();
                });
        }
        if((coursename == "practice") && (tags.length > 0)){
                var tagsstr = tags.join(",");
                seturlparams(`?c=${coursename}&i=${categoryname}&tags=${tagsstr}`);
        }
    });
});
function gen_breadcrumbs(data){
    let htm = "";
    if((data.zone != undefined)&&(data.zone != 0)){
        hasbreadcrumbs = 1;
        htm += `<div id="exam-category-selector">
            <div class="exam-category-trigger" id="exam-trigger-btn">
            <span class="exam-category-current-label">${data.zone.name}</span>
            <i class="fa-solid fa-chevron-down exam-category-chevron"></i>
            </div>
            <div class="exam-category-menu" id="exam-options-list">`;
        $.each(data.zone.items, function (itemindx, item){
            let activeclass = '';
            if(item.active != undefined){
                activeclass = 'is-selected';
            }
            htm += `<div class="exam-category-option ${activeclass}" title="${item.fullname}" onclick="window.location.href='?c=${item.nav_url}&i=${categoryname}';"><span class="ic-box"><img src="${item.icon}" alt=""></span>${item.name}</div>`;
        });
        htm += `</div>
            </div>`;
    }
    return htm;
}
function gen_hdr_brand_area(data){
    let htm = '';
    htm += `
        <div class="hdr-logo-group">
        <span id="mob-sidebar"  style="font-size:24px;line-height: 0; margin-right: 6px;color: #6A7282; "><i class="fa-solid fa-bars"></i></span>
        <img src="img/logo/tlogo-28.png" alt="Oliveboard">
        </div>
        <div class="hdr-divider"></div>`;
    htm += `<span class="mob-wal mob-search"><img src="img/ic-search2.svg" alt=""></span>`;
    htm += `<button data-toggle="modal" class="hdr-category-btn" data-target="#selcategoryModal">${data.catsel.name}<img  src="img/dw-arr.svg" alt""></button>`;
    return htm;
}
function gen_categorymodalbox(data){
    let htm = `
        <!--Category Modal -->
        <div class="modal fade in" id="selcategoryModal" tabindex="-1" role="dialog" aria-labelledby="selcategoryModalLabel" aria-hidden="false">
        <div id="catselmodal" class="modal-dialog" role="document">
        <div class="modal-content">
        <div class="modal-header">
        <h5 class="modal-title" id="selcategoryModalLabel">${data.catsel.title}</h5>
        <p class="modal-subtitle">${data.catsel.subtitle}</p>
        <button type="button" class="close sc-close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">×</span></button>
        </div>
        <div class="modal-body">
        <div class="category-group">`;
    $.each(data.catsel.items, function (_, item){
        htm += `<a onclick="window.location.href='?c=dashboard&i=${item.navurl}';">
            <div class="card category-card">
            <span><img src="${item.icon}" alt=""></span>
            <h3>${item.title}</h3>
            <p>${item.subtitle}</p>
            </div>
            </a>`;
    });
    htm += `
        </div>
        </div>
        </div>
        </div>
        </div>`;
    return htm;
}
function gen_horizontalmenu(data){
    let htm = "";

    if (!data.hideoveralltabs) {

        htm += `
            <!-- 1. Top Tabs Row -->
            <div class="tabs-wrapper">
            <span class="scroll-arrow left-arrow">&#10094;</span>
            <div class="fltr-tabs-row">
            `;

        let active = "active";

        if(data.tabdata === undefined){
            data.tabdata = [];
            $.each(data.blocks, function(blockindx, block){
                if(block.hastab != undefined){
                    let tabitem = {
                        "name": removeHTMLTags(block["title"]),
                        "code": "tab-" + blockindx
                    };
                    data.tabdata.push(tabitem);
                    block["tabcode"] = "tab-" + blockindx;
                }
            });
        }
        data.tabdata.forEach(tab => {
            if((coursename == 'videolessons') && (tags.length > 0) && (!tags.includes(tab.inttag))){
                return false;
            }
            const tabsecclass = tab.sectioncode
                ? `allsections sec-${tab.sectioncode}`
                : "";

            htm += `
                <a
            class="${tabsecclass} fltr-tab-link ${active}"
            data-tabcode="${tab.code}"
                >
                ${tab.name}
                </a>
                `;
            active = "";
        });

        if (data.allsections && Object.keys(data.allsections).length > 1) {
            htm += `
                <div class="fmd-trigger-wrapper">
                <!-- Filter Button -->
                <button class="fmd-trigger-btn" id="openFilterBtn">
                <img src="img/funnel.svg" />
                <span class="fmd-filter-indicator"></span>
                </button>
                </div>
                `;
        }

        const rightArrowStyle =
            data.allsections ? ' style="margin-right: 45px;"' : "";

        htm += `
            </div>
            <span${rightArrowStyle} class="scroll-arrow right-arrow">&#10095;</span>
            </div>
            `;
    }
    return htm;
}
function make_menu(data){
    let htm = "";

    if (data && data.menu) {
        data.menu.forEach(item => {
            if (item.shortname === "Videos" &&
                ["sscvideolessons", "videolessons", "jkjavid", "jkfinvid"].includes(coursename)
            ) {
                item.active = "active";
                item.icon = item.icon.replace(".svg", "_active.svg");
                item.url = "";
            }
            else if (
                item.shortname === "Dashboard" &&
                ["dashboard"].includes(coursename)
            ) {
                item.active = "active";
                item.icon = item.icon.replace(".svg", "_active.svg");
            }
            else if (
                item.shortname === "Tests" &&
                ![
                    "freebooks",
                    "sscvideolessons",
                    "videolessons",
                    "jkjavid",
                    "jkfinvid",
                    "dashboard"
                ].includes(coursename) &&
                !coursename.includes("bookmarks") &&
                !coursename.includes("pyp")
            ) {
                item.active = "active";
                item.icon = item.icon.replace(".svg", "_active.svg");
            }
            else if (
                item.shortname === "Bookmarks" &&
                coursename.includes("bookmarks")
            ) {
                item.active = "active";
                item.icon = item.icon.replace(".svg", "_active.svg");
            }
            else if (
                item.shortname === "PYPs" &&
                coursename.includes("pyp")
            ) {
                item.active = "active";
                item.icon = item.icon.replace(".svg", "_active.svg");
            }
            const urladd = (item.urltype === "newwin") ? ' target="_blank"' : "";
            const active = item.active || "";

            htm += `
                <a${urladd} href="${item.url}" class="plainanchor sm-nav-item ${active}">
                <img src="${item.icon}" />
                <span class="sm-text-desk">${item.name}</span>
                <span class="sm-text-mob">${item.shortname}</span>
                </a>
                `;
        });
    }
    $(".sm-nav-container").html(htm);
    htm = "";
    if(data && data.menu) {
        htm = `
            <div class="mobile-menu-overlay" id="mobileMenu">
            <button class="mobile-menu-close" id="closeMenu">&times;</button>
            <nav class="mobile-menu-nav">
            `;
        data.menu.forEach(item => {
            const urladd = (item.urltype === "newwin") ? ' target="_blank"' : "";
            const active = item.active || "";

            htm += `
                <a${urladd} href="${item.url}" class="mobile-menu-item ${active}">
                ${item.shortname}
                </a>
                `;

        });
        htm += `
            </nav>
            </div>
        `;
    }
    $(".sm-nav-container").after(htm);
}
function make_fmdoverlay(data){
    let htm = "";
    if (data && data.allsections) {
        htm += `
            <!-- Overlay / Modal / Dropdown -->
            <div class="fmd-overlay" id="filterModal">
            <div class="fmd-card">

            <!-- Mobile Header (Hidden on Desktop) -->
            <div class="fmd-mobile-header">
            <h3 class="fmd-title">Filters</h3>
            <button class="fmd-close-btn" id="closeFilterBtn">
            <img src="img/cls.svg" alt="">
            </button>
            </div>

            <!-- Checkbox List -->
            <div class="fmd-list-area">
            `;

        // Sort sections alphabetically by section name (same as PHP asort)
        const sortedSections = Object.entries(data.allsections)
            .sort((a, b) => String(a[1]).localeCompare(String(b[1])));

        sortedSections.forEach(([sectioncode, section]) => {
            htm += `
                <label class="fmd-checkbox-row">
                <input type="checkbox"
            data-sectioncode="${sectioncode}"
            class="fmd-checkbox-input"
            checked>
                <div class="fmd-custom-box">
                <img src="img/checkbx.svg" alt="" class="fmd-check-icon">
                </div>
                <span class="fmd-label-text">${section}</span>
                </label>
                `;
        });

        htm += `
            </div>

            <!-- Footer Actions -->
            <div class="fmd-actions-area">
            <button class="fmd-btn-clear">Clear Filters</button>
            <button class="fmd-btn-apply">Apply</button>
            </div>

            <div class="fmd-errmsg-area">
            <p class="fmd-errmsg" id="fmd-errmsg"></p>
            </div>

            </div>
            </div>
            `;
    }
    $(".main-wrapper").prepend(htm);
}
function hideunusedviewall(){
    $(".crs-card-row").each(function(){
        if ($(this).get(0).scrollWidth <= $(this).innerWidth()) {
            var thisid = $(this).attr("id").split("-")[2];
            $('.crs-view-all[data-section="'+thisid+'"]').hide();
        }
    });
}
function showTopCards(numview) {
    $('.tpc-card').hide();                 // hide all
    $('.tpc-card').slice(0, numview).show(); // show first numview
}
function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/;domain=.oliveboard.in";
}
function setCookiehours(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/;domain=.oliveboard.in";
}

function seturlparams(getparams){
    window.history.replaceState({}, "", getparams);
}

var openedWindow = null;
function openwin(url,windowname)
{
    windowname = windowname || '';
    h = screen.height * 0.85; 
    w = screen.width; 
    var nwin = window.open(url,windowname,'width=' + w + ',height=' + h + ',scrollbars=yes,resizable=1,location=no,menubar=no,titlebar=no,toolbar=no'); 
    if (window.focus) {nwin.focus()}
    return false;
}

function openmodal(url, solnurl){
    var acontent = `<iframe id="aiframe" src="${url}" width="100%" frameborder="0" scrolling="no"></iframe>`;
    $('#analysisBody').html(acontent);
    if(solnurl != ""){
        var vsbtn = `${solnurl}`;
        vsbtn = 'openwin("'+vsbtn+'","Solutions");';
        $("#viewsolnbtn").attr('onclick',vsbtn);
        $(".sumt-header").show();
    } else {
        $(".sumt-header").hide();
    }
    $("#summaryModal").modal('show');
}

$(document).on("click", ".oviewtrigger", function(e){
    e.preventDefault();
    var videoSRC = $(this).attr("src");
    var videoSRCauto = videoSRC + "?autoplay=1";
    $("#oviewmodalIframe").attr('src', videoSRCauto);
    $("#videoModal").on('hidden.bs.modal', function(e) {
        $("#oviewmodalIframe").attr('src', '');
    });
});
function opencallreqmodal(){
    const formurl = 'https://www.oliveboard.in/myaccount/buy/android/call2.php';
    $("#callreqmodal").modal("show");
    $("#modalIframe").attr("src", formurl);
}
$("#closeModal").on("click", function(){
    $("#callreqmodal").modal("hide");
});
$(document).on("click", ".morelink", function(){
    var thisid = $(this).attr("id");
    var tid = thisid.split("-")[1];
    $(".txtexpand-" + tid).hide();
    $(".txtexpandmore-" + tid).show();
    $("#testi-"+tid).removeClass("txtexpandmore")
    $(this).hide();
});
$(window).on('scroll', function () {
    var scrollPos = $(window).scrollTop() + $(window).height() / 3;

    var lastActiveTab = null;
    $('section[class*="tab-"]').each(function () {
        var top = $(this).offset().top;
        var bottom = top + $(this).outerHeight();

        if (scrollPos >= top && scrollPos < bottom) {
            var classes = $(this).attr('class').split(/\s+/);
            var tabCode = classes.find(function (cls) {
                return cls.indexOf('tab-') === 0;
            });

            if (tabCode && tabCode !== lastActiveTab) {
                lastActiveTab = tabCode;

                var $container = $('.fltr-tabs-row');
                var $activeTab = $('.fltr-tab-link[data-tabcode="' + tabCode + '"]');

                $('.fltr-tab-link').removeClass('active');
                $activeTab.addClass('active');

                if ($activeTab.length) {
                    var containerScrollLeft = $container.scrollLeft();
                    var containerWidth = $container.outerWidth();

                    var tabLeft = $activeTab.position().left;
                    var tabRight = tabLeft + $activeTab.outerWidth();

                    // stop previous animation (important!)
                    $container.stop(true);

                    if (tabLeft < 0) {
                        // scroll left
                        $container.animate({
                            scrollLeft: containerScrollLeft + tabLeft - 20
                        }, 200);
                    } else if (tabRight > containerWidth) {
                        // scroll right
                        $container.animate({
                            scrollLeft: containerScrollLeft + (tabRight - containerWidth) + 20
                        }, 200);
                    }
                }
            }
        }
    });

});

// Toggle Menu on button click
$('#profileDropdownBtn').on('click', function(e) {
    e.stopPropagation(); // Prevent document click from firing
    $('#profileDropdownMenu').toggleClass('is-open');
});

$(document).on('click', '.fltr-tab-link', function(e) {
    $('.fltr-tab-link').removeClass('active');
    $(this).addClass('active');
    var tabcode = $(this).attr('data-tabcode');
    var container = $('html, body');
    var target = container.find('.' + tabcode).first();
    var headerHeight = $('.hdr-main').outerHeight();

    if (target.length) {
        container.animate({
            scrollTop: target.offset().top - headerHeight - 70
        }, 400);
    }
    e.preventDefault();
});

// Language Toggle Logic
$(document).on('click', '.fltr-lang-btn', function() {
    $('.fltr-lang-btn').removeClass('active');
    $(this).addClass('active');
    var language = $(this).attr('data-language');
    if(language == 'All'){
        $(".alllang").show();
        makesectionsvisible();
        return false;
    }
    $(".alllang").hide();
    $(".lang-" + language).show();
    makesectionsvisible();
});
function makesectionsvisible()
{
    $('section.langhideable').each(function () {

        var section = $(this);
        section.show();

        if (section.find('.crs-card:visible').length === 0) {
            section.hide();
        } 
    });
}

const $modal = $('#mobileSearchModal');
const $body = $('body');

// Open Modal
$('.fltr-search-btn-mob').on('click', function() {
    $modal.addClass('is-open');
    $body.css('overflow', 'hidden'); // Prevent background scrolling

    // Optional: Auto-focus input after animation completes
    setTimeout(function() {
        $('.msm-input').focus();
    }, 300);
});

// Close Modal via X Button
$('#closeMobileSearch').on('click', function() {
    closeModal();
});

// Close Modal by clicking outside the white box (on the dark overlay)
$modal.on('click', function(e) {
    if (e.target.id === 'mobileSearchModal') {
        closeModal();
    }
});

// Reusable close function
function closeModal() {
    $modal.removeClass('is-open');
    $('#filterModal').removeClass('is-open');
    $body.css('overflow', ''); // Restore background scrolling
}

$(document).on('click', '.crs-view-all', function () {
    var v_type = $(this).attr('data-section');
    var $row = $('#card-row-' + v_type);

    if ($(this).text().trim() === 'View All') {
        $row.css('flex-wrap', 'wrap');
        $(this).text('View Less');
    } else {
        $row.css('flex-wrap', 'nowrap');
        $(this).text('View All');
    }
});

$('.hdr-category-btn').click(function(){
    $('#selcategoryModal').show();
    $('.modal-backdrop').show();
    $('.modal-backdrop').addClass('in');
    $('.hdr-main').css('z-index','1040');
});

$('.sc-close').click(function(){
    $('#selcategoryModal').hide();
    $('.modal-backdrop').hide();
    $('.modal-backdrop').removeClass('in');
    $('.hdr-main').css('z-index','1040');
});
$('.modal').on('hidden.bs.modal', function () {
    $(".modal-backdrop").hide();
    $('.modal-backdrop').removeClass('in');
    $('.hdr-main').css('z-index','1040');
});
// Close menu when clicking outside
$(document).on('click', function(e) {
    if (!$("#profileDropdownMenu").is(e.target) && $("#profileDropdownMenu").has(e.target).length === 0) {
        $("#profileDropdownMenu").removeClass('is-open');
    }
    if (!$('#filterModal').find('.fmd-card').is(e.target) && $('#filterModal').find('.fmd-card').has(e.target).length === 0) {
        closeModal();
    }
    closeExamMenu();
});
$(document).on('click', '.fmd-btn-clear', function(e) {                                                    
    e.preventDefault(); // Prevent any default button behavior                                    
    $('#filterModal').find('.fmd-checkbox-input').prop('checked', false);                         
});                                                                                               
$(document).on('click', '.fmd-btn-apply', function(e) {
    var checked = $('.fmd-checkbox-input:checked').length;

    if(checked == 0){
        $("#fmd-errmsg").text("Select atleast one section");
        return false;
    }
    $("#fmd-errmsg").text("");
    e.preventDefault();
    applysectionfilters();
    updateFilterIndicator();
    closeModal();
});

$(document).on('click', '#openFilterBtn', function(e) {
    e.stopPropagation(); // Prevent document click
    $('#filterModal').toggleClass('is-open');

    // Prevent body scroll on mobile only
    if ($(window).width() < 580) {
        if($('#filterModal').hasClass('is-open')) {
            $('body').css('overflow', 'hidden');
        } else {
            $('body').css('overflow', '');
        }

    }
    var ht = $('.hdr-main').outerHeight() + $('.fltr-tabs-row').outerHeight();
    var rt_w = $('.fmd-trigger-btn').offset().rigth;
    $('#filterModal').css('top', ht+'px');
    $('#filterModal').css('right', rt_w+'px');

});

let debounceTimer;
var searchurl = "https://u2.oliveboard.in/search/searchlite.php";
$(document).on("input", "#searchbox", function(){
    $(".tabs-wrapper").hide();
    $("html, body").animate({
        scrollTop: 0
    }, 'fast');
    var searchterm = $("#searchbox").val();
    searchterm = searchterm.trim();
    if (searchterm.length < 3){
        $(".section-search").remove();
        $(".mpt-wrapper").remove();
        $(".tabs-wrapper").show();
        return false;
    }
    if (searchterm == ''){
        $(".section-search").remove();
        $(".mpt-wrapper").remove();
        $(".tabs-wrapper").show();
        return false;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
        $.get(searchurl, { susmid: susmid, s: searchterm }, function(searchhtml) {
            $(".section-search").remove();
            $(".mpt-wrapper").remove();
            if(searchhtml != ""){
                $(".crs-main-wrapper").prepend(searchhtml);
            }
        });
    }, 1000);
});

function applysectionfilters() {
    var sectionCodes = $('.fmd-checkbox-input:checked')
        .map(function() {
            return $(this).data('sectioncode');
        })
        .get();
    $('.allsections').hide().removeClass('active-section');

    $('.sec-' + sectionCodes.join(',.sec-'))
        .show()
        .addClass('active-section');

    refreshObserver();
    updateUpcomingBlocks();
}
function updateOverlayVisibility() {
    if ($('.allsections:visible').length > 0) {
        $('.fmd-trigger-wrapper').show();
    } else {
        $('.fmd-trigger-wrapper').hide();
    }
}
let visibleCount = 0;

function refreshObserver() {
    visibleCount = 0;
    observer.disconnect();
    $('.allsections').each(function() {
        observer.observe(this);
    });
}
function updateFilterIndicator() {
    var total = $('.fmd-checkbox-input').length;
    var checked = $('.fmd-checkbox-input:checked').length;

    if (checked < total) {
        $('.fmd-filter-indicator').show();
    } else {
        $('.fmd-filter-indicator').hide();
    }
}
let overlayTimeout = null;
const visibleSet = new Set();

function updateOverlayDebounced(isVisible) {
    clearTimeout(overlayTimeout);
    overlayTimeout = setTimeout(function() {
        $('.fmd-trigger-wrapper').toggle(isVisible);
    }, 120);
}

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {

        if (entry.intersectionRatio > 0.2) {
            visibleSet.add(entry.target);
        } else if (entry.intersectionRatio < 0.05) {
            visibleSet.delete(entry.target);
        }

    });

    updateOverlayDebounced(visibleSet.size > 0);

}, {
    threshold: [0, 0.05, 0.2]
});
function updateUpcomingBlocks() {
    $('.tabswithitems').each(function() {
        var hasActiveChild = $(this).find('.allsections.active-section').length > 0;
        $(this).toggle(hasActiveChild);
    });
}

$(document).on('click', '.lsc-card-wrapper', function(e) {
    if(!$(this).hasClass('lockedcard')){
        if ($(window).width() < 991) {
            let url = $(this).data('url');
            openwin(url, 'myvwindow');
        }
    }
});

const CLIENT_ID = '832699440069-fcjckdt5ds5gem6k5oavnohd4og2lvr2.apps.googleusercontent.com';
const API_KEY ='AIzaSyCSg-oLG5K5P7gt2dLEAp1VUqW8FhFupJg';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events.owned';

let tokenClient;
let gapiInited = false;
let gisInited = false;

function gapiLoaded() {
    gapi.load('client', intializeGapiClient);
}

async function intializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeproceed();
}
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
    });
    gisInited = true;
    maybeproceed();
}

function maybeproceed() {
    if (gapiInited && gisInited) {
        handleAuth();
    }
}

var gotperm = 0;
function handleAuth() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        $("#btn-googlesignin1").html('<span><img src="/img/ic-google-ls.svg" alt=""></span>Add Alerts');
        gotperm = 1;
        $("#btn-googlesignin1").click(function() {finalsubmit(); });
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
}


function loadJS(file, lfunc) {
    var jsElm = document.createElement("script");
    jsElm.type = "application/javascript";
    jsElm.src = file;
    jsElm.addEventListener('load', lfunc);
    document.body.appendChild(jsElm);
}


var alertdata;
var alertcoursename;
function setalerts(c){
    alertcoursename = c;
    $("#addalertmodal").modal("show");
    $("#addalertmessage").html("By Signing up you are giving Oliveboard permission to add reminders to your Google Calendar Account");
}
function alertfirstclick(){
    if (gotperm == 1){
        return false;
    }
    $("#btn-googlesignin1").html('<span><img src="/img/ic-google-ls.svg" alt=""></span>Linking and Getting Permission from your Google Account');
    $.get("getalerts.php", {"coursename": alertcoursename}, function(alertresp){
        alertdata = JSON.parse(alertresp)
        $("#addalertmessage").html(alertdata["message"]);
        loadJS("https://apis.google.com/js/api.js", gapiLoaded);
        loadJS("https://accounts.google.com/gsi/client", gisLoaded);
    });
}
function finalsubmit(){
    var allevents = [];
    $.each(alertdata["events"], function(eindx, evalue){
        e = {
            "summary": evalue[3],
            "description": evalue[2] + " - " + evalue[3] + " at oliveboard.in ",
            "start": {
                "dateTime": evalue[0],
                "timeZone": "Asia/Calcutta"
            },
            "end": {
                "dateTime": evalue[1],
                "timeZone": "Asia/Calcutta"
            },
            "reminders": {
                "useDefault": false,
                "overrides": [
                    {"method": "email", "minutes": 1 * 60},
                    {"method": "popup", "minutes": 10}
                ]
            }
        };
        allevents.push(e);

    });
    var batch = gapi.client.newBatch();
    for(var eventi=0; eventi < allevents.length; eventi += 1){
        batch.add(gapi.client.calendar.events.insert({
            'calendarId': 'primary',
            'resource': allevents[eventi]
        }));
    }
    batch.then(function(){
        $("#addalertmodal").modal("hide");
        $("#alertmessage").html("You will receive alerts for all upcoming sessions in this course");
    });
}
$(document).on('click', '.right-arrow', function () {
    var $container = $('.fltr-tabs-row');
    $container.animate({
        scrollLeft: $container.scrollLeft() + 200
    }, 200);
});

$(document).on('click', '.left-arrow', function () {
    var $container = $('.fltr-tabs-row');
    $container.animate({
        scrollLeft: $container.scrollLeft() - 200
    }, 200);
});

function updateArrows() {
    var $container = $('.fltr-tabs-row')[0];

    var scrollLeft = $container.scrollLeft;
    var scrollWidth = $container.scrollWidth;
    var clientWidth = $container.clientWidth;

    // Show both only if scroll exists
    if (scrollWidth > clientWidth) {
        $('.left-arrow, .right-arrow').show();
    } else {
        $('.left-arrow, .right-arrow').hide();
        return;
    }

    // Disable left arrow
    if (scrollLeft <= 0) {
        $('.left-arrow').addClass('disabled');
    } else {
        $('.left-arrow').removeClass('disabled');
    }

    // Disable right arrow
    if (scrollLeft + clientWidth >= scrollWidth - 1) {
        $('.right-arrow').addClass('disabled');
    } else {
        $('.right-arrow').removeClass('disabled');
    }
}

//Select Exam

$(document).on('click', '#exam-trigger-btn', function(e) {
    const $examtriggerbtn = $('#exam-trigger-btn');
    const $selector = $('#exam-category-selector');
    const $menu = $('#exam-options-list');
    e.stopPropagation();

    const isOpening = !$examtriggerbtn.hasClass('is-expanded');

    if (isOpening) {
        if (!$('.custom-backdrop').length) {
            $('body').append('<div class="custom-backdrop"></div>');
        }
        $('.custom-backdrop').show();
        $examtriggerbtn.addClass('is-expanded');
        $menu.css('display', 'flex').animate({
            opacity: 1,
            top: '48px' // Slightly adjusted position during animation
        }, {
            duration: 200,
            step: function(now, fx) {
                if (fx.prop === 'top') {
                    $(this).css('transform', 'translateY(0)');
                }
            }
        });
    } else {
        closeExamMenu();
    }
});

// --- Utility: Close Menu ---
function closeExamMenu() {
    const $examtriggerbtn = $('#exam-trigger-btn');
    const $selector = $('#exam-category-selector');
    const $menu = $('#exam-options-list');
    $examtriggerbtn.removeClass('is-expanded');
    $menu.animate({
        opacity: 0
    }, 150, function() {
        $(this).css({
            'display': 'none',
            'transform': 'translateY(-10px)',
            'top': 'calc(100% + 8px)'
        });
    });
    $('.custom-backdrop').remove();
}
//Carousel and timer
let currentIndex = 0;

function goToSlide(index) {
    const $dots = $('.lmm-dot');
    const $slides = $('.lmm-carousel-slide');
    const slideCount = $slides.length;
    const $track = $('#lmmCarouselTrack');
    // Ensure index bounds
    if (index < 0) index = slideCount - 1;
    if (index >= slideCount) index = 0;

    currentIndex = index;

    // Move track via CSS transform (Hardware accelerated)
    const translateX = -(currentIndex * 100);
    $track.css('transform', `translateX(${translateX}%)`);

    // Update dots
    $dots.removeClass('active');
    $dots.eq(currentIndex).addClass('active');
}
// Dot Clicks                                                                                     
$(document).on('click', '.lmm-dot', function() {                                                                    
    const index = $(this).data('index');                                                          
    goToSlide(index);                                                                             
});                                                                                               
// Next/Prev Buttons
$(document).on('click', '#lmmNextBtn', function() {
    goToSlide(currentIndex + 1);
});

$(document).on('click', '#lmmPrevBtn', function() {
    goToSlide(currentIndex - 1);
});

function setupcountdowns(){
    function format(num) {
        return num < 10 ? "0" + num : num;
    }

    function updateTimer(seconds, indx) {
        var $timer = $("#lmmtimer-" + indx);

        var days = Math.floor(seconds / 86400);
        var hrs = Math.floor((seconds % 86400) / 3600);
        var mins = Math.floor((seconds % 3600) / 60);
        var secs = seconds % 60;

        var blocks = $timer.find(".lmm-inline-block");

        // DAYS
        if (days > 0) {
            $(blocks[0]).show().find(".lmm-in-num").text(format(days));
        } else {
            $(blocks[0]).hide();
        }

        // HRS
        if (days > 0 || hrs > 0) {
            $(blocks[1]).show().find(".lmm-in-num").text(format(hrs));
        } else {
            $(blocks[1]).hide();
        }

        // MIN
        if (days > 0 || hrs > 0 || mins > 0) {
            $(blocks[2]).show().find(".lmm-in-num").text(format(mins));
        } else {
            $(blocks[2]).hide();
        }

        // SEC (always show until zero)
        $(blocks[3]).show().find(".lmm-in-num").text(format(secs));

        // Handle colons visibility
        var colons = $timer.find(".lmm-in-colon");

        $(colons[0]).toggle(days > 0);
        $(colons[1]).toggle(days > 0 || hrs > 0);
        $(colons[2]).toggle(days > 0 || hrs > 0 || mins > 0);
    }

    // Initialize all countdowns
    ltcountdowns.forEach(function (item) {
        var seconds = item[0];
        var indx = item[1];

        updateTimer(seconds, indx);
        $("#lmmtimer-" + indx).show();
        var interval = setInterval(function () {

            if (seconds <= 0) {
                clearInterval(interval);
                updateTimer(0, indx);
                $("#livetestdata-group-" + indx).css("display", "block");
                $("#ltcountdownblock-" + indx).css("display", "none");
                return;
            }

            updateTimer(seconds, indx);
            seconds--;

        }, 1000);
    });

}
$('.tpc-view-btn').on('click', function() {
    // Update Button Active State
    $('.tpc-view-btn').removeClass('active');
    $(this).addClass('active');

    // Get target view (list or grid)
    const targetView = $(this).data('view');
    const $wrapper = $('#tpc-state-wrapper');

    // Swap classes to trigger CSS layout changes
    if (targetView === 'list') {
        $wrapper.removeClass('tpc-view-grid').addClass('tpc-view-list');
    } else {
        $wrapper.removeClass('tpc-view-list').addClass('tpc-view-grid');
    }
});

$(document).on('click', '.completed_test', function(){
    if($(window).width() < 991){
        $('.mrp-actions-list').html('');
        $('.mrp-header-title').text($(this).find('.tpc-title').text());
        let actiontitle = $(this).find('.tpc-btn-main').text();
        let actiontarget = $(this).find('.tpc-btn-main').attr('onclick');
        $('.mrp-actions-list').append(`<a onclick="${actiontarget}" class="mrp-action-card"><h3 class="mrp-card-title">${actiontitle}</h3><p class="mrp-card-desc"></p></a>`);
        $.each($(this).find('.tpc-secondary-actions'), function(secondarybtnindx, secondarybtn){
            actiontitle = $(secondarybtn).text();
            actiontarget = $(secondarybtn).attr('onclick');
            $('.mrp-actions-list').append(`<a onclick="${actiontarget}" class="mrp-action-card"><h3 class="mrp-card-title">${actiontitle}</h3><p class="mrp-card-desc"></p></a>`);
        });

        $('.mrp-mobile-container').css('display','flex');
    }
});

$(document).on("click", ".start_test_card.locked", function(){
    $("#buyModal").modal("show");
});
$(document).on('click', '.tpc-view-all', function (e) {
    e.preventDefault();

    var scrollPos = $(window).scrollTop(); // save position

    var $btn = $(this);
    var $parent = $btn.closest('div');
    var $cards = $parent.find('.tpc-card');
    var numview = parseInt($btn.data('numview')) || 10;

    var isExpanded = $btn.data('expanded') || false;

    if (isExpanded) {
        $cards.hide().slice(0, numview).show();
        $btn.html('View More <i class="fas fa-chevron-down"></i>');
        $('html, body').animate({
            scrollTop: $parent.offset().top - 140
        }, 300);

    } else {
        $cards.show();
        $btn.html('View Less <i class="fas fa-chevron-up"></i>');
    }

    $btn.data('expanded', !isExpanded);

    // restore scroll position
    $(window).scrollTop(scrollPos);
});
$('.completed_test').click(function(){
    if($(window).width() < 991){
        var btn1 = $(this).find('.tpc-btn-main');
        $('#mrp-action-card-1')
            .off('click')
            .on('click', function (e) {
                btn1.trigger('click');
            });

        var btn2 = $(this).find('.tpc-secondary-actions');
        $('#mrp-action-card-2')
            .off('click')
            .on('click', function (e) {
                btn2.trigger('click');
            });

        var mrptitle = $(this).find('.tpc-title').text();
        $(".mrp-header-title").text(mrptitle);


        $('.mrp-mobile-container').css('display','flex');
    }
});

$('.mrp-back-btn').click(function(){
    $('.mrp-mobile-container').hide();
});
$('.start_test_card').click(function(){
    if($(window).width() < 991){
        var url = $(this).attr("data-url");
        window.location.href=  url;
    }
});

$('#closeFilterBtn').on('click', function() {
    closeModal();
});


function renderBannersBlock(block, blockindx) {

    let html = `
        <div class="lmm-wrapper">

        <div class="lmm-top-section">

        <div class="lmm-carousel-container">

        <div class="lmm-carousel-track"
    id="lmmCarouselTrack"
    style="transform: translateX(0%);">
        `;

    $.each(block.items, function (itemindx, item) {

        let onclickfun;

        if (item[2] === "new") {
            onclickfun = `window.open('${item[1]}');`;
        } else {
            onclickfun = `window.location.href='${item[1]}';`;
        }

        html += `
            <div class="lmm-carousel-slide lmm-slide-${itemindx + 1}"
        onclick="${onclickfun}">
            <img  src="${item[0]}">
            </div>
            `;

    });

    html += `
        </div>

        <div class="lmm-carousel-controls">

        <button class="lmm-arrow-btn" id="lmmPrevBtn">
        <img src="img/ic-carlf.svg" alt="">
        </button>

        <div class="lmm-dots-wrap">
        `;

    $.each(block.items, function (itemindx) {

        html += `
            <div class="lmm-dot ${itemindx === 0 ? 'active' : ''}"
        data-index="${itemindx}">
            </div>
            `;

    });

    html += `
        </div>

        <button class="lmm-arrow-btn" id="lmmNextBtn">
        <img src="img/ic-carrt.svg" alt="">
        </button>

        </div>

        </div>

        </div>

        </div>
        `;

    return html;
}

function renderCountdownBlock(block, blockindx) {
    let html = '';

    if (block.secs != 0) {
        ltcountdowns.push([block.secs, blockindx]);

        html += renderCountdownBanner(block, blockindx);
    }

    const hideStyle = block.secs != 0 ? 'style="display:none;"' : '';

    html += `
        <section class="alltabs ${block.tabcode}"
    id="livetestdata-group-${blockindx}"
    ${hideStyle}>

        <div class="tpc-container">

        <div class="crs-section-header">
        <h2 class="crs-section-title">${block.title}</h2>
        </div>`;
    if((block.subtitle != undefined) && (block.subtitle != '')){
        html += `<div class="crs-section-header">
            <h2 class="crs-section-subtitle">${block.boxes[0].title}</h2>
            </div>`;
    }
    html += `
        <div class="tpc-wrapper tpc-view-list" id="tpc-state-wrapper">
        `;

    $.each(block.boxes[0].livetests, function (_, item) {

        if (item.type === "available") {
            html += renderAvailableTest(item);
        }

    });

    html += `
        </div>
        </div>
        </section>
        `;

    return html;
}

function renderBannerCountdownBlock(block, blockindx) {

    let html = '';

    // setting up live test countdowns
    if (block.secs != 0) {
        ltcountdowns.push([block.secs, blockindx]);
    }

    html += `
        <div class="lmm-wrapper">

        <div class="lmm-top-section">

        <div class="lmm-carousel-container">

        <div class="lmm-carousel-track"
    id="lmmCarouselTrack"
    style="transform: translateX(0%);">
        `;

    $.each(block.items, function (itemindx, item) {

        let onclickfun;

        if (item[2] === "new") {
            onclickfun = `window.open('${item[1]}');`;
        } else {
            onclickfun = `window.location.href='${item[1]}';`;
        }

        html += `
            <div class="lmm-carousel-slide lmm-slide-${itemindx + 1}"
        onclick="${onclickfun}">
            <img src="${item[0]}">
            </div>
            `;
    });

    html += `
        </div>

        <div class="lmm-carousel-controls">

        <button class="lmm-arrow-btn" id="lmmPrevBtn">
        <img src="img/ic-carlf.svg" alt="">
        </button>

        <div class="lmm-dots-wrap">
        `;

    $.each(block.items, function (itemindx) {
        html += `
            <div class="lmm-dot ${itemindx === 0 ? 'active' : ''}"
        data-index="${itemindx}">
            </div>
            `;
    });

    html += `
        </div>

        <button class="lmm-arrow-btn" id="lmmNextBtn">
        <img src="img/ic-carrt.svg" alt="">
        </button>

        </div>

        </div>

        <div class="lmm-timer-card">

        <div class="lmm-meta-group">
        <h3 class="lmm-title">${block.title}</h3>

        <div class="lmm-subtitle">
        <img src="img/ic-cal.svg" class="lmm-icon-cal" alt="">
        ${block.subtitle}
        </div>
        </div>

        <div class="lmm-inline-timer"
    style="display:none;"
    id="lmmtimer-${blockindx}">

        <div class="lmm-inline-block">
        <span class="lmm-in-num">XX</span>
        <span class="lmm-in-lbl">DAYS</span>
        </div>

        <div class="lmm-in-colon">:</div>

        <div class="lmm-inline-block">
        <span class="lmm-in-num">XX</span>
        <span class="lmm-in-lbl">HRS</span>
        </div>

        <div class="lmm-in-colon">:</div>

        <div class="lmm-inline-block">
        <span class="lmm-in-num">XX</span>
        <span class="lmm-in-lbl">MIN</span>
        </div>

        <div class="lmm-in-colon">:</div>

        <div class="lmm-inline-block">
        <span class="lmm-in-num">XX</span>
        <span class="lmm-in-lbl">SEC</span>
        </div>

        </div>

        </div>

        </div>

        </div>
        `;

    return html;
}
function renderExamsBlock(block, blockindx) {
    let html = `
        <section class="alltabs ${block.tabcode}" id="section-${block.tabcode}">
        <div class="mpt-header">
        <h2 class="mpt-title">${removeHTMLTags(block.title)}</h2>
        </div>

        <div class="mpt-card-bg">
        <div class="mpt-items-container crs-card-row" id="card-row-${block.tabcode}">
        `;

    $.each(block.items, function (_, item) {
        let thisnavurl = item.navurl;
        if(thisnavurl.includes('lessons')){
            html += `
                <div class="mpt-item"
            style="cursor:pointer;"
            onclick="openwin('${thisnavurl}', 'myvwindow');">

                <div class="mpt-icon-circle mpt-color-1">
                <img src="${item.icon}" width="32" height="32" />
                </div>

                <div class="mpt-item-text" title="${removeHTMLTags(item.title)}">
                ${item.title}
                </div>

                </div>
                `;
        }else{
            if(thisnavurl.includes('?c=')){
                thisnavurl = thisnavurl.split('?c=')[1];
            }
            html += `
                <div class="mpt-item"
            style="cursor:pointer;"
            onclick="window.location.href='?c=${thisnavurl}';">

                <div class="mpt-icon-circle mpt-color-1">
                <img src="${item.icon}" width="32" height="32" />
                </div>

                <div class="mpt-item-text" title="${removeHTMLTags(item.title)}">
                ${item.title}
                </div>

                </div>
                `;

        }

    });

    html += `
        </div>
        </div>
        </section>
        `;

    return html;
}
function renderResourcesBlock(block, blockindx) {
    let html = `
        <section class="scr-wrapper alltabs ${block.tabcode}">

        <div class="scr-header-wrap">
        <div class="scr-header-left">
        <h2 class="scr-main-title">${block.title}</h2>
        <p class="scr-subtitle">Practice tests and study materials</p>
        </div>
        </div>

        <div class="scr-grid">
        `;

    $.each(block.items, function (_, item) {

        html += `
            <div class="scr-card">

            <div class="scr-card-header">
            <div class="scr-icon-box">
            <img src="img/resourcelist.svg" />
            </div>

            <h3 class="scr-card-title">${item.title}</h3>
            </div>

            <div class="scr-card-body">
            `;

        $.each(item.buttons, function (_, button) {
            //button.navurl = button.navurl.replace('/exams/','/tests/');
            if (button.navtype === "newwin") {

                html += `
                    <a style="cursor:pointer;"
                onclick="openwin('${button.navurl}','myvwindow');"
                class="scr-link-item">
                    <span>${button.buttontext}</span>
                    <img src="img/lf-arr.svg" class="scr-arrow-icon" alt="">
                    </a>
                    `;

            } else {

                html += `
                    <a href="${button.navurl}" class="scr-link-item">
                    <span>${button.buttontext}</span>
                    <img src="img/lf-arr.svg" class="scr-arrow-icon" alt="">
                    </a>
                    `;

            }

        });

        html += `
            </div>

            </div>
            `;

    });

    html += `
        </div>

        </section>
        `;

    return html;
}
function renderOtherCategoriesBlock(block, blockindx) {
    let html = `
        <section class="eoc-wrapper">

        <div class="eoc-header">
        <h2 class="eoc-title">${block.title}</h2>
        </div>

        <div class="eoc-grid-container">
        `;

    $.each(block.items, function (_, item) {

        html += `
            <a href="?c=dashboard&i=${item.navurl}" class="eoc-card">

            <div class="eoc-icon-box">
            <img src="${item.icon}" alt="${block.title}">
            </div>

            <h3 class="eoc-card-title">
            ${item.title}
            </h3>

            <p class="eoc-card-desc">
            ${item.subtitle}
            </p>

            </a>
            `;

    });

    html += `
        </div>

        </section>
        `;

    return html;
}
function renderVideosBlock(block, blockindx) {
    let html = `
        <section class="alltabs ${block.tabcode} upcoming-class-block">
        <div class="crs-section-header">
        <h2 class="crs-section-title">${block.title}</h2>
        </div>

        <div class="crs-card-row" id="card-row-three" style="flex-wrap:nowrap;">
        `;

    $.each(block.items, function (_, item) {

        html += `
            <div class="up-cards">

            <div class="title-blk">
            <h3 style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${item.title}
            </h3>

            ${item.isfree !== undefined
                    ? '<span class="ctype-tag">Free</span>'
                    : ''
            }
            </div>

            <div class="info-blk">

            <div class="info-row"
        title="${item.section}"
        style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            <span class="img-bx">
            <img src="img/sec.svg" alt="">
            </span>
            ${item.sectionshort}
            </div>

            <div class="info-row">
            <span class="img-bx">
            <img src="img/time.svg" alt="">
            </span>
            ${item.duration}
            </div>

            <div class="info-row"
        title="${item.mentorfullname}"
        style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            <span class="img-bx">
            <img src="img/user.svg" alt="">
            </span>
            ${item.mentor}
            </div>

            </div>

            <div class="btn-grp">

            <button onclick="openwin('${item.url}');">
            <span><img src="img/play.svg" alt=""></span>
            Watch Video
            </button>

            <div class="extra-btn-group">

            <div class="ex-row" onclick="openwin('${item.url}&dtab=quiz');">
            <span class="img-bx"><img src="img/brain.svg" alt=""></span>
            <span class="ex-txt">Quiz</span>
            </div>

            <div class="ex-row" onclick="openwin('${item.url}&dtab=fcard');">
            <span class="img-bx"><img src="img/openbook.svg" alt=""></span>
            <span class="ex-txt">Cards</span>
            </div>

            <div class="ex-row" onclick="openwin('${item.url}&dtab=dnotes');">
            <span class="img-bx"><img src="img/notes.svg" alt=""></span>
            <span class="ex-txt">Notes</span>
            </div>

            <div class="ex-row" onclick="openwin('${item.url}&dtab=qna');">
            <span class="img-bx"><img src="img/bulb.svg" alt=""></span>
            <span class="ex-txt">Imp Qs</span>
            </div>

            <div class="ex-row" onclick="openwin('${item.url}&dtab=pdf');">
            <span class="img-bx"><img src="img/pdf.svg" alt=""></span>
            <span class="ex-txt">PDF</span>
            </div>

            </div>

            </div>

            </div>
            `;

    });

    html += `
        </div>
        </section>
        `;

    return html;
}
function renderClassesBlock(block, blockindx) {
    let html = `
        <section class="alltabs ${block.tabcode} upcoming-class-block" id="section-upcoming">
        <div class="crs-section-header">
        <h2 class="crs-section-title">${block.title}</h2>
        <a class="crs-view-all" data-section="upcoming">View All</a>
        </div>

        <div class="crs-card-row" style="flex-wrap:nowrap;" id="card-row-upcoming">
        `;

    $.each(block.items, function (_, item) {

        html += `
            <div class="up-cards">

            <div class="title-blk">
            <h3 style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${item.title}
            </h3>

            ${item.islive == 1
                    ? '<span class="ctype-tag ctypetagred">&bull; Live</span>'
                    : ''
            }
            </div>

            <div class="info-blk">

            <div class="info-row"
        title="${item.section}"
        style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            <span class="img-bx">
            <img src="img/sec.svg" alt="">
            </span>
            ${item.sectionshort}
            </div>

            <div class="info-row">
            <span class="img-bx">
            <img src="img/time.svg" alt="">
            </span>
            ${item.duration}
            </div>

            <div class="info-row"
        title="${item.mentorfullname}"
        style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            <span class="img-bx">
            <img src="img/user.svg" alt="">
            </span>
            ${item.mentor}
            </div>

            </div>

            <div class="btn-grp">
            <button onclick="openwin('${item.url}');">
            <span><img src="img/play.svg" alt=""></span>
            Join Now
            </button>
            </div>

            </div>
            `;

    });

    html += `
        </div>
        </section>
        `;

    return html;
}
function renderMockTestDataBlock(block, blockindx) {
    mocktestblocktitle = removeHTMLTags(block.title);
    let html = `
        <section class="alltabs ${block.tabcode}" id="mtestdata">
        <div class="tpc-container">
        <div class="crs-section-header">
        <h2 class="crs-section-title" id="mocktestblocktitle">${removeHTMLTags(block.title)}</h2>
        </div>`;
    if((block.subtitle != undefined) && (block.subtitle != '')){
        html += `<div class="crs-section-header">
            <h2 class="crs-section-subtitle">${removeHTMLTags(block.subtitle)}</h2>
            </div>`;
    }
    html += `
        <div class="tpc-wrapper tpc-view-list" id="tpc-state-wrapper">
        `;

    let numtestitems = 0;
    $.each(block.items, function (itemindx, item) {
        if((coursename == 'practice') && (tags.length > 0) && (!tags.includes(item.inttag))){
            return true;
        }

        switch (item.type) {
            case "availablebutton":
                html += renderAvailableButton(item);
                break;

            case "completedbutton":
                html += renderCompletedButton(item);
                break;

            case "olivescore":
                html += renderOliveScore(item);
                break;

            case "completed":
                html += renderCompletedTest(item);
                numtestitems += 1;
                break;

            case "available":
                html += renderAvailableTest(item);
                numtestitems += 1;
                break;

            case "resume":
                html += renderResumeTest(item);
                numtestitems += 1;
                break;

            case "locked":
                html += renderLockedTest(item);
                numtestitems += 1;
                break;

            case "comingsoon":
                html += renderComingSoonTest(item);
                numtestitems += 1;
                break;
        }

    });
    if((coursename == 'practice') && (tags.length > 0)){
        mocktestblocktitle = 'Topic Tests [' + numtestitems + ']';
        $('.fltr-tab-link[data-tabcode="' + block.tabcode+ '"]').text(mocktestblocktitle);
    }

    html += `
        </div>
        `;

    if (numtestitems > block.numview) {
        html += `
            <a class="tpc-view-all" data-numview=${block["numview"]} data-section="${blockindx + 1}">View More <i class="fas fa-chevron-down"></i></a>
            `;
    }

    html += `
        </div>
        </section>
        `;

    return html;
}
function renderHtmlBlock(block, blockindx) {
    let html = `
        <section class="alltabs ${block.tabcode} upcoming-class-block">
        <div class="crs-section-header" style="flex-direction: column;align-items: flex-start;">
        <h2 class="crs-section-title">${block.title}</h2>
        </div>

        ${block.htmldata}
        </section>
        `;

    return html;
}


function renderFreeBooksItemListBlock(block, blockindx) {
    let html = `
        <section class="alltabs tabswithitems upcoming-class-block">
        <div class="vid-row">
        `;

    $.each(block.items, function (_, item) {
        html += renderFreeEbook(item, coursename, category);
    });

    html += `
        </div>
        </section>
        `;

    return html;
}

function renderCoursesBlock(block, blockindx) {
    let html = '';

    if (!langfiltershown) {
        html += `
            <div class="fltr-nav-wrapper">
            <div class="fltr-controls-row">
            <div class="fltr-lang-toggle">
            <button data-language="All" class="fltr-lang-btn active">All</button>
            <button data-language="e" class="fltr-lang-btn">English</button>
            <button data-language="h" class="fltr-lang-btn">Hinglish</button>
            </div>
            </div>
            </div>
            `;
        langfiltershown = true;
    }

    html += `
        <section class="langhideable alltabs ${block.tabcode}" id="section-${blockindx + 1}">
        <div class="crs-section-header">
        <h2 class="crs-section-title">${block.title}</h2>
        `;

    if (block.items.length > 5) {
        html += `
            <a class="crs-view-all" data-section="${blockindx + 1}">View All</a>
            `;
    }

    html += `
        </div>

        <div class="crs-card-row" style="flex-wrap:nowrap;" id="card-row-${blockindx + 1}">
        `;

    $.each(block.items, function (_, item) {

        html += `
            <div class="alllang crs-card lang-${item.language}"
        onclick="window.location.href='${item.url}';">

            <div class="crs-t1-img-wrap">
            <img src="${item.img}" alt="">
            </div>

            <div class="crs-t1-body"
        style="display:flex;flex-direction:row;align-items:center;justify-content:space-between;">

            <div class="crs-avatars-group">
            `;

        $.each(item.portraits, function (_, facid) {
            console.log(facid);
            portrait = facinfo[facid];
            html += `
                <div title="${portrait.name}" class="crs-avatar">
                <img src="${portrait.icon}" alt="${portrait.name}">
                </div>
                `;
        });

        if (item.starttext == '') {
            html += `</div></div></div>`;
        }else{
        
            html += `
                </div>

                <div style="font-size:12px;display:flex;align-items:center;gap:6px;">
                <img src="${item.starticon}" />
                ${item.starttext}
                </div>

                </div>
                </div>
            `;
        }
    });

    html += `
        </div>
        </section>
        `;

    return html;
}
function renderItemListBlock(block, blockindx) {
    if((coursename == 'videolessons') && (tags.length > 0) && (!tags.includes(block.inttag))){
        return '';
    }
    let html = `
        <section class="alltabs tagfltr-${block.inttag} tabswithitems ${block.tabcode} upcoming-class-block">
        <div class="crs-section-header">
        <h2 class="crs-section-title">${block.title}</h2>
        </div>

        <div class="vid-row">
        `;

    $.each(block.items, function (_, item) {

        if (item.locked == 1) {
            html += renderLockedCard(item, coursename, category);

        } else if (item.status === "airecavailable") {
            html += renderAirecAvailableNew(item, coursename, category);

        } else if (item.classtype === "ebook") {
            html += renderEbook(item, coursename, category);
        }

    });

    html += `
        </div>
        </section>
        `;

    return html;
}

function gen_blocks(data){
    let html = '';
    $.each(data.blocks, function (blockindx, block) {

        switch (block.type) {

            case "courses":
                html += renderCoursesBlock(block, blockindx);
                break;

            case "itemlist":
                html += renderItemListBlock(block, blockindx);
                break;

            case "freebooksitemlist":
                html += renderFreeBooksItemListBlock(block, blockindx);
                break;

            case "mocktestdata":
                block.items = data.mocktestdata
                numview = block.numview;
                html += renderMockTestDataBlock(block, blockindx);
                break;

            case "html":
                html += renderHtmlBlock(block, blockindx);
                break;

            case "classes":
                html += renderClassesBlock(block, blockindx);
                break;

            case "videos":
                html += renderVideosBlock(block, blockindx);
                break;

            case "othercategories":
                html += renderOtherCategoriesBlock(block, blockindx);
                break;

            case "resources":
                html += renderResourcesBlock(block, blockindx);
                break;

            case "exams":
                html += renderExamsBlock(block, blockindx);
                break;

            case "bannercountdown":
                html += renderBannerCountdownBlock(block, blockindx);
                break;

            case "countdown":
                html += renderCountdownBlock(block, blockindx);
                break;

            case "banners":
                html += renderBannersBlock(block, blockindx);
                break;

        }

    });
    return html;
}
function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function renderFlags(item) {
    if ((item.isfree == 1) || (item.status === "live")) {

        let html = '<span class="tags-parent">';

        if (item.isfree == 1) {
            html += `
                <span class="ctype_tag">
                Free
                </span>
                `;
        }

        if (item.status === "live") {
            html += `
                <span class="c_indicator">
                &#11044; Live
                </span>
                `;
        }

        html += '</span>';

        return html;
    }

    return "";
}
function renderLscTitle(item) {
    return `
        <div class="lsc-title-area">
        <h3 class="lsc-title"
    title="${escapeHtml(item.topic)}">
        ${escapeHtml(item.topic)}
        </h3>

        <!-- Mobile Bookmark Icon -->
        <button class="lsc-bookmark-btn" style="display:none;">
        <img src="img/lscbookmark.svg" />
        </button>

        ${renderFlags(item)}
        </div>
        `;
}
function renderLscMetaInfo(item) {
    let html = `
        <!-- Standardized Meta Info -->
        <div class="lsc-meta-group">

        <!-- Type -->
        <div class="lsc-meta-item lsc-meta-classtype">
        <div class="lsc-card">
        <img src="img/lscclasstype.svg" />
        <span class="lsc-txt">
        ${item.type ? escapeHtml(item.type) : "Live"}
        </span>
        </div>
        </div>

        <!-- Folder/Subject -->
        <div class="lsc-meta-item lsc-meta-section">
        <div class="lsc-card">
        <img src="img/folderd.svg" />
        <span title="${escapeHtml(item.section)}" class="lsc-txt">
        ${escapeHtml(item.section)}
        </span>
        </div>
        </div>
        `;

    if (item.hrduration) {
        html += `
            <!-- Time -->
            <div class="lsc-meta-item lsc-meta-duration">
            <div class="lsc-card">
            <img src="img/lscduration.svg" />
            <span class="lsc-txt">
            ${escapeHtml(item.hrduration)}
            </span>
            </div>
            </div>
            `;
    }

    html += `
        <!-- User -->
        <div class="lsc-meta-item lsc-meta-faculty">
        <div class="lsc-card">
        <img src="img/lscfaculty.svg" />
        <span title="${escapeHtml(item.faculty)}" class="lsc-txt">
        ${escapeHtml(item.faculty)}
        </span>
        </div>
        </div>

        </div>
        `;

    return html;
}
function renderLscMetaInfoLive(item) {
    let html = `
        <!-- Standardized Meta Info -->
        <div class="lsc-meta-group">

        <!-- Type -->
        <div class="lsc-meta-item lsc-meta-classtype">
        <div class="lsc-card">
        <img src="img/lscclasstype.svg" />
        <span class="lsc-txt">Live</span>
        </div>
        </div>

        <!-- Folder/Subject -->
        <div class="lsc-meta-item lsc-meta-section">
        <div class="lsc-card">
        <img src="img/folderd.svg" />
        <span title="${escapeHtml(item.section)}" class="lsc-txt">
        ${escapeHtml(item.section)}
        </span>
        </div>
        </div>
        `;

    if (item.hrduration) {
        html += `
            <!-- Time -->
            <div class="lsc-meta-item lsc-meta-duration">
            <div class="lsc-card">
            <img src="img/lscduration.svg" />
            <span class="lsc-txt">
            ${escapeHtml(item.hrstartdate_time)}
            </span>
            </div>
            </div>
            `;
    }

    html += `
        <!-- User -->
        <div class="lsc-meta-item lsc-meta-faculty">
        <div class="lsc-card">
        <img src="img/lscfaculty.svg" />
        <span title="${escapeHtml(item.faculty)}" class="lsc-txt">
        ${escapeHtml(item.faculty)}
        </span>
        </div>
        </div>

        </div>
        `;

    return html;
}
function renderLscFreeEbookMetaInfo(item) {
    return `
        <!-- Standardized Meta Info -->
        <div class="lsc-meta-group" style="max-width:100%;">

        <!-- Folder/Subject -->
        <div class="lsc-meta-item txtfull lsc-meta-section">
        <div class="lsc-card">
        <img src="img/lscclasstype.svg" />
        <span class="lsc-txt">
        ${escapeHtml(item.tabnames)}
        </span>
        </div>

        <div class="lsc-card">
        <img src="img/folderd.svg" />
        <span class="lsc-txt">
        ${escapeHtml(item.section)}
        </span>
        </div>
        </div>

        </div>
        `;
}
function renderLscEbookMetaInfo(item) {
    return `
        <!-- Standardized Meta Info -->
        <div class="lsc-meta-group">

        <!-- Folder/Subject -->
        <div class="lsc-meta-item txtfull lsc-meta-section">
        <div class="lsc-card">
        <img src="img/folderd.svg" />
        <span
    title="${escapeHtml(item.section)}"
    class="lsc-txt">
        ${escapeHtml(item.section)}
        </span>
        </div>
        </div>

        </div>
        `;
}
function renderLscActions(url) {
    //const safeUrl = escapeHtml(url);
    const safeUrl = escapeHtml(url.replace('index.php', 'material.php'));

    return `
        <!-- Action Links -->
        <div class="lsc-actions-area">
        <div class="lsc-action-list">

        <a onclick="openwin('${safeUrl}&dtab=quiz','myvwindow');" class="lsc-action-item">
        <img src="img/lscquiz.svg" />
        <span>Quiz</span>
        </a>

        <a onclick="openwin('${safeUrl}&dtab=fcard','myvwindow');" class="lsc-action-item">
        <img src="img/lsccard.svg" />
        <span>Cards</span>
        </a>

        <a onclick="openwin('${safeUrl}&dtab=dnotes','myvwindow');" class="lsc-action-item">
        <img src="img/lscnotes.svg" />
        <span>Notes</span>
        </a>

        <a onclick="openwin('${safeUrl}&dtab=qna','myvwindow');" class="lsc-action-item">
        <img src="img/lscqna.svg" />
        <span>Imp Qs</span>
        </a>

        <a style="display:none;" onclick="openwin('${safeUrl}&dtab=pdf','myvwindow');" class="lsc-action-item">
        <img src="img/lscpdf.svg" />
        <span>PDF</span>
        </a>

        </div>
        </div>
        `;
}
function renderEbook(item, coursename, category) {
    return `
        <div
    data-url="${escapeHtml(item.classid)}"
    class="allsections sec-${escapeHtml(item.sectioncode)} lsc-card-wrapper white_bg">

        <!-- Left Column -->
        <div class="lsc-left-col">
        <div class="lft-parent">
        ${renderLscTitle(item)}
    ${renderLscEbookMetaInfo(item)}
        </div>
        </div>

        <!-- Right Column -->
        <div class="lsc-right-col">
        <button
    class="lsc-desktop-btn btn-pdf"
    onclick="openwin('${escapeHtml(item.classid)}','myvwindow');">

        <img src="img/lscebook.svg" />
        <span class="lsc-txt">View PDF</span>
        </button>
        </div>

        </div>
        `;
}

function renderAirecAvailableNew(item, coursename, category) {
    const url = item.classid;

    return `
        <div
    data-url="${escapeHtml(url)}"
    class="lsc-card-wrapper white_bg allsections sec-${escapeHtml(item.sectioncode)}">

        <div class="lsc-left-col">
        <div class="lft-parent">
        ${renderLscTitle(item)}
    ${renderLscMetaInfo(item)}
        </div>
        </div>

        <div class="lsc-divider"></div>

        <div class="lsc-right-col">

        <button
    class="lsc-desktop-btn"
    onclick="openwin('${escapeHtml(url)}','myvwindow');">

        <img src="img/lscplay.svg" />
        Watch

        </button>

        ${renderLscActions(url)}

        </div>

        </div>
        `;
}

function renderUpcomingCard(item) {
    return `
        <div class="lsc-card-wrapper white_bg allsections sec-${escapeHtml(item.sectioncode)}">

        <!-- Left -->
        <div class="lsc-left-col">
        <div class="lft-parent">
        ${renderLscTitle(item)}
    ${renderLscMetaInfo(item)}
        </div>
        </div>

        <div class="lsc-divider"></div>

        <!-- Right -->
        <div class="lsc-right-col">
        <div class="upcm-blk">

        <div class="blk-card">
        <img src="img/lsccalendar.svg" />
        <span class="cls-date">
        ${escapeHtml(item.hrstartdate_date)}
        </span>
        </div>

        <div class="blk-card">
        <img src="img/lsctime.svg" />
        <span class="cls-time">
        ${escapeHtml(item.hrstartdate_time)}
        </span>
        </div>

        </div>
        </div>

        </div>
        `;
}
function renderLockedCard(item, coursename, category) {
    return `
        <div
    data-toggle="modal"
    data-target="#buyModal"
    class="lsc-card-wrapper lockedcard white_bg allsections sec-${escapeHtml(item.sectioncode)}">

        <div class="lsc-left-col">
        <div class="lft-parent">
        ${renderLscTitle(item)}
    ${renderLscMetaInfo(item)}
        </div>
        </div>

        <div class="lsc-right-col">
        <button class="lsc-desktop-btn btn-unlock">
        <img src="img/lsclock.svg" />
        <span class="lsc-txt">Unlock</span>
        </button>
        </div>

        </div>
        `;
}
function renderRecAvailableCompleted(item, coursename, category) {
    const url =
        "/obivs/recplayer/?c=" + encodeURIComponent(coursename) +
        "&session=0&i=" + encodeURIComponent(category) +
        "&classid=" + encodeURIComponent(item.classid);

    return `
        <div
    data-url="${escapeHtml(url)}"
    class="lsc-card-wrapper allsections sec-${escapeHtml(item.sectioncode)}">

        <div class="lsc-left-col">
        <div class="lft-parent">
        ${renderLscTitle(item)}
    ${renderLscMetaInfo(item)}
        </div>
        </div>

        <div class="lsc-divider"></div>

        <div class="lsc-right-col">

        <button
    class="lsc-desktop-btn"
    onclick="openwin('${escapeHtml(url)}','myvwindow');">

        <img src="img/lscplay.svg" />
        Watch Again

        </button>

        </div>

        </div>
        `;
}
function renderRecAvailableInProgress(item, coursename, category) {
    const url =
        "/obivs/recplayer/?c=" + encodeURIComponent(coursename) +
        "&session=0&i=" + encodeURIComponent(category) +
        "&classid=" + encodeURIComponent(item.classid);

    const watched = item.watched ? parseInt(item.watched, 10) : 0;

    return `
        <div
    data-url="${escapeHtml(url)}"
    class="lsc-card-wrapper white_bg allsections sec-${escapeHtml(item.sectioncode)}">

        <div class="lsc-left-col">
        <div class="lft-parent">
        ${renderLscTitle(item)}
    ${renderLscMetaInfo(item)}
        </div>
        </div>

        <div class="lsc-divider"></div>

        <div class="lsc-right-col">

        <button
    class="lsc-desktop-btn btn-resume"
    style="background:linear-gradient(90deg, #E6F1F6 ${watched}%, #FFF 0%)"
    onclick="openwin('${escapeHtml(url)}','myvwindow');">

        <img src="img/lscresume.svg" />
        Resume Video

        </button>

        </div>

        </div>
        `;
}
function renderLive(item, coursename, category) {
    const url =
        "/obivs/player4/?c=" + encodeURIComponent(coursename) +
        "&i=" + encodeURIComponent(category) +
        "&classid=" + encodeURIComponent(item.classid);

    return `
        <div
    data-url="${escapeHtml(url)}"
    class="lsc-card-wrapper white_bg allsections sec-${escapeHtml(item.sectioncode)}">

        <div class="lsc-left-col">
        <div class="lft-parent">
        ${renderLscTitle(item)}
    ${renderLscMetaInfoLive(item)}
        </div>
        </div>

        <div class="lsc-divider"></div>

        <div class="lsc-right-col">

        <button
    class="lsc-desktop-btn"
    onclick="openwin('${escapeHtml(url)}','myvwindow');">

        <img src="img/lscplay.svg" />
        Join Now

        </button>

        </div>

        </div>
        `;
}
function renderLiveToday(item, coursename, category) {
    const url =
        "/obivs/player4/?c=" + encodeURIComponent(coursename) +
        "&i=" + encodeURIComponent(category) +
        "&classid=" + encodeURIComponent(item.classid);

    return `
        <div
    data-url="${escapeHtml(url)}"
    class="lsc-card-wrapper white_bg allsections sec-${escapeHtml(item.sectioncode)}">

        <div class="lsc-left-col">
        <div class="lft-parent">
        ${renderLscTitle(item)}
    ${renderLscMetaInfoLive(item)}
        </div>
        </div>

        <div class="lsc-divider"></div>

        <div class="lsc-right-col">

        <button
    class="lsc-desktop-btn"
    onclick="openwin('${escapeHtml(url)}','myvwindow');">

        <img src="img/lscplay.svg" />
        Join Now

        </button>

        </div>

        </div>
        `;
}
function renderRecWait(item, coursename, category) {
    return `
        <div
    class="lsc-card-wrapper white_bg allsections sec-${escapeHtml(item.sectioncode)}">

        <div class="lsc-left-col">
        <div class="lft-parent">
        ${renderLscTitle(item)}
    ${renderLscMetaInfo(item)}
        </div>
        </div>

        <div class="lsc-divider"></div>

        <div
    class="lsc-right-col"
    title="The class has concluded. Please wait for recording to be available.">

        <button
    class="lsc-desktop-btn"
    style="cursor:not-allowed;background:gray;"
    disabled>

        Wait for Recording

        </button>

        </div>

        </div>
        `;
}
function renderRecAvailableNew(item, coursename, category) {
    const url =
        "/obivs/recplayer/?c=" + encodeURIComponent(coursename) +
        "&session=0&i=" + encodeURIComponent(category) +
        "&classid=" + encodeURIComponent(item.classid);

    return `
        <div
    data-url="${escapeHtml(url)}"
    class="lsc-card-wrapper white_bg allsections sec-${escapeHtml(item.sectioncode)}">

        <div class="lsc-left-col">
        <div class="lft-parent">
        ${renderLscTitle(item)}
    ${renderLscMetaInfo(item)}
        </div>
        </div>

        <div class="lsc-divider"></div>

        <div class="lsc-right-col">

        <button
    class="lsc-desktop-btn"
    onclick="openwin('${escapeHtml(url)}','myvwindow');">

        <img src="img/lscplay.svg" />
        Watch

        </button>

        </div>

        </div>
        `;
}
function renderLPS(item, coursename, category) {
    const url =
        "/edge/lps/start.php?testid=" + encodeURIComponent(item.classid) +
        "&cid=" + encodeURIComponent(coursename);

    return `
        <div
    data-url="${escapeHtml(url)}"
    class="lsc-card-wrapper white_bg allsections sec-${escapeHtml(item.sectioncode)}">

        <div class="lsc-left-col">
        <div class="lft-parent">
        ${renderLscTitle(item)}
    ${renderLscMetaInfo(item)}
        </div>
        </div>

        <div class="lsc-divider"></div>

        <div class="lsc-right-col">

        <button
    class="lsc-desktop-btn"
    onclick="openwin('${escapeHtml(url)}','myvwindow');">

        <img src="img/lscplay.svg" />
        Join Now

        </button>

        </div>

        </div>
        `;
}
function renderInterview(item, coursename, category) {
    const url = item.url;

    return `
        <div
    data-url="${escapeHtml(url)}"
    class="lsc-card-wrapper white_bg allsections sec-${escapeHtml(item.sectioncode)}">

        <div class="lsc-left-col">
        <div class="lft-parent">
        ${renderLscTitle(item)}
    ${renderLscMetaInfo(item)}
        </div>
        </div>

        <div class="lsc-divider"></div>

        <div class="lsc-right-col">

        <button
    class="lsc-desktop-btn"
    onclick="openwin('${escapeHtml(url)}','myvwindow');">

        <img src="img/lscplay.svg" />
        ${escapeHtml(item.subtopic)}

        </button>

        </div>

        </div>
        `;
}
function renderFreeEbook(item, coursename, category) {
    const url = item.url;

    return `
        <div
    data-url="${escapeHtml(url)}"
    class="${escapeHtml(item.tag)} white_bg lsc-card-wrapper">

        <!-- Left Column -->
        <div class="lsc-left-col">
        <div class="lft-parent">
        ${renderLscTitle(item)}
    ${renderLscFreeEbookMetaInfo(item)}
        </div>
        </div>

        <!-- Right Column -->
        <div class="lsc-right-col">
        <button
    class="lsc-desktop-btn btn-pdf"
    onclick="openwin('${escapeHtml(url)}','myvwindow');">

        <img src="img/lscebook.svg" />
        <span class="lsc-txt">View PDF</span>

        </button>
        </div>

        </div>
        `;
}
function renderAvailableButton(item) {
    /*$.each(item.buttons, function(btnindx, btn){
        if(item.buttons[btnindx].length > 1){
            item.buttons[btnindx][1] = item.buttons[btnindx][1].replace('/exams/','/tests/');
        }
    });*/
    if (item.testname.includes("OliveScore")) {
        item.type = "olivescore";
        item.olivescore = item.testname
        item.cta = item.buttons[0][0];
        item.url = item.buttons[0][1];
        item.navtype = "newwin";
        const match = item.testname.match(/\b(\d+)\s*\/\s*100\b/);
        item.olivescore = match ? parseInt(match[1], 10) : "-";
        return renderOliveScore(item);
    }else{
        item.cta = item.buttons[0][0];
        item.url = item.buttons[0][1];
    }
    let html = `
        <div class="ipb-banner-container">

        <div class="ipb-text-group">
        <h2 class="ipb-title">${item.testname}</h2>
        `;

    if (item.subtitle !== undefined) {
        html += `
            <p class="ipb-desc">${item.subtitle}</p>
            `;
    }

    html += `
        </div>

        <div class="ipb-action-area">
        `;

    $.each(item.buttons, function(buttonindx, button){
    if (item.buttons[buttonindx][2]=== "newwin") {

        html += `
            <button class="ipb-btn"
        onclick="openwin('${item.buttons[buttonindx][1]}');">
            ${button[0]}
            </button>
            `;
    }
    else if (item.navtype === "newtab") {

        html += `
            <button class="ipb-btn"
        onclick="openwin('${item.buttons[buttonindx][1]}');">
            ${button[0]}
            </button>
            `;
    } else {

        html += `
            <button class="ipb-btn"
        onclick="window.location.href='${item.buttons[buttonindx][1]}';">
            ${button[0]}
            </button>
            `;

    }
    });

    html += `
        </div>

        </div>
        `;

    return html;
}
function renderCompletedButton(item) {
    let html = `
        <div class="ipb-banner-container">

        <div class="ipb-text-group">
        <h2 class="ipb-title">${item.testname}</h2>
        `;

    if (item.subtitle !== undefined) {
        html += `
            <p class="ipb-desc">${item.subtitle}</p>
            `;
    }

    html += `
        </div>

        <div class="ipb-action-area">`;

    $.each(item.buttons, function(buttonindx, button){
        html += `<button class="ipb-btn"
    onclick="openwin('${button[1]}');">
        ${button[0]}
        </button>`;
    });

    html += `
        </div>

        </div>
        `;

    return html;
}
function renderOliveScore(item) {
    return `
        <div id="olive-readiness-assessment-banner">

        <div class="readiness-pointer-score-box">
        <div class="score-digit">
        ${item.olivescore}
        </div>
        </div>

        <div id="olive-readiness-text-content">

        <div class="olive-branding-text-group">
        <div class="brand-blue-part">Olive</div>
        <div class="brand-gold-part">Score</div>
        </div>

        <div class="olive-readiness-headline">
        Your Exam Readiness Score
        </div>

        <div class="olive-readiness-subtext">
        Get personalized learning recommendations based on your test performance across all topics
        </div>

        </div>

        <div class="olive-readiness-action-wrap"
    onclick="openwin('${item.url}');">

        <div class="btn-navigation-report-trigger"
    id="js-report-redirect-trigger">
        ${item.cta}
        </div>

        </div>

        </div>
        `;
}
function getperc(a, b) {
    a = Number(a);
    b = Number(b);

    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) {
        return 0;
    }

    return Math.round((a / b) * 100);
}


function renderCompletedTest(item) {
    item.correctperc = getperc(item.correct, item.qmax);
    item.wrongperc = getperc(item.wrong, item.qmax);
    item.unatt = item.qmax - item.correct - item.wrong;
    item.unattperc = getperc(item.unatt, item.qmax);
    /* Moving Solution and Analysis to the first button */
    if (item.buttons && item.buttons.length > 1) {
        const idx = item.buttons.findIndex(btn =>
            Array.isArray(btn) &&
            typeof btn[0] === "string" &&
            btn[0].includes("Solution")
        );

        if (idx > 0) {
            item.buttons.unshift(item.buttons.splice(idx, 1)[0]);
        }
    }
    let onclickfuns = [];
    $.each(item.buttons, function(buttonindx, button){
        switch (button[2]) {
            case 'modal':
                onclickfuns.push(`openmodal('${button[1]}','${button[3]}');`);
                break;
            case 'newwin':
                onclickfuns.push(`openwin('${button[1]}');`);
                break;
            case 'same':
                onclickfuns.push(`window.location.href='${button[1]}';`);
                break;
            default:
                onclickfuns.push(`window.location.href='${button[1]}';`);
                break;
        }
    });
    let htm = `
        <div class="tpc-card bg_comp_green completed_test">

        <div class="tpc-col-info">

        <h3 class="tpc-title">
        ${item.testname}
        </h3>

        <div class="tpc-scores">

        <div class="tpc-score-item">
        <img src="img/checklist.svg" alt="" class="tpc-icon-list">
        <div class="tpc-score-text">
        <span class="tpc-val">${item.total}/${item.scoremax}</span>
        <span class="tpc-lbl">Score</span>
        </div>
        </div>

        <div class="tpc-score-item">
        <img src="img/acc.svg" class="tpc-icon-list" alt="">
        <div class="tpc-score-text">
        <span class="tpc-val">${Math.round(item.accuracy)}%</span>
        <span class="tpc-lbl">Accuracy</span>
        </div>
        </div>

        </div>

        </div>

        <div class="tpc-col-progress">

        <div class="tpc-bar-container">
        <div class="tpc-bar-green" style="width:${item.correctperc}%;"></div>
        <div class="tpc-bar-red" style="width:${item.wrongperc}%;"></div>
        <div class="tpc-bar-grey" style="width:${item.unattperc}%;"></div>
        </div>

        <div class="tpc-legends">
        <span class="tpc-leg">
        <span class="tpc-dot tpc-dot-green"></span>
        ${item.correct} Correct
        </span>

        <span class="tpc-leg">
        <span class="tpc-dot tpc-dot-red"></span>
        ${item.wrong} Wrong
        </span>

        <span class="tpc-leg">
        <span class="tpc-dot tpc-dot-grey"></span>
        ${item.unatt} Skipped
        </span>
        </div>

        </div>

        <div class="tpc-col-actions">

        <button class="tpc-btn-main"
    onclick="${onclickfuns[0]}">
        <img src="img/ic-sol.svg" alt="">
        ${item.buttons[0][0]}
        </button>`;


    switch(item.buttons.length) {
        case 1:
            break;
        case 2:
            htm += `<div class="tpc-secondary-actions"
            onclick="${onclickfuns[1]}">
                <a
            class="tpc-sec-link"
            style="width:100% !important;"
            alt="">
                ${item.buttons[1][0]}
                </a>
                </div>`;

            break;
        case 3:
            htm += `<div class="tpc-secondary-actions">
                <a onclick="${onclickfuns[1]}" class="tpc-sec-link">
                ${item.buttons[1][0]}
                </a>
                <a onclick = "${onclickfuns[2]}" class="tpc-sec-link">
                ${item.buttons[2][0]}
                </a>
                </div>`;
            break;
        case 4:
            htm += `<div class="tpc-secondary-actions">
                <a onclick="${onclickfuns[1]}" class="tpc-sec-link">
                ${item.buttons[1][0]}
                </a>
                <a onclick="${onclickfuns[2]}" class="tpc-sec-link">
                ${item.buttons[2][0]}
                </a>
                <a onclick="${onclickfuns[3]}" class="tpc-sec-link">
                ${item.buttons[3][0]}
                </a>
                </div>`;
            break;
    }
    htm += `   
        </div>
        </div>`;
    ;
    return htm;
}
function renderAvailableTest(item) {
    return `
        <div class="tpc-card start_test_card"
    data-url="${item.buttons[0][1]}" onclick="openwin('${item.buttons[0][1]}');">

        <div class="tpc-col-info">

        <h3 class="tpc-title">
        ${item.testname}
    ${item.isfree == 1 ? '<span class="cls-tag">Free</span>' : ''}
        </h3>

        <div class="tpc-scores">

        <div class="tpc-score-item">
        <img src="img/numq.svg" />
        <div class="tpc-score-text">
        <span class="tpc-val">${item.qmax} Questions</span>
        </div>
        </div>

        <div class="tpc-score-item">
        <img src="img/duration.svg" />
        <div class="tpc-score-text">
        <span class="tpc-val">${item.totaltime}</span>
        </div>
        </div>

        <div class="tpc-score-item">
        <img src="img/marks.svg" />
        <div class="tpc-score-text">
        <span class="tpc-val">${item.scoremax} Marks</span>
        </div>
        </div>

        </div>

        </div>

        <div class="tpc-col-actions start_test_container">

        <button class="tpc-btn-main">
        <img src="img/playoutline.svg" />
        Start Test
        </button>

        </div>

        </div>
        `;
}
function renderResumeTest(item) {
    return `
        <div class="tpc-card start_test_card">

        <div class="tpc-col-info">

        <h3 class="tpc-title">
        ${item.testname}
    ${item.isfree == 1 ? '<span class="cls-tag">Free</span>' : ''}
        </h3>

        <div class="tpc-scores">

        <div class="tpc-score-item">
        <img src="img/numq.svg" />
        <div class="tpc-score-text">
        <span class="tpc-val">${item.qmax} Questions</span>
        </div>
        </div>

        <div class="tpc-score-item">
        <img src="img/duration.svg" />
        <div class="tpc-score-text">
        <span class="tpc-val">${item.totaltime}</span>
        </div>
        </div>

        <div class="tpc-score-item">
        <img src="img/marks.svg" />
        <div class="tpc-score-text">
        <span class="tpc-val">${item.scoremax} Marks</span>
        </div>
        </div>

        </div>

        </div>

        <div class="tpc-col-actions start_test_container">

        <button class="tpc-btn-main btn_resume">
        <img src="img/resumeoutline.svg" />
        Resume Test
        </button>

        </div>

        </div>
        `;
}
function renderLockedTest(item) {
    return `
        <div class="tpc-card start_test_card locked">

        <div class="tpc-col-info">

        <h3 class="tpc-title">
        ${item.testname}
        </h3>

        <div class="tpc-scores">

        <div class="tpc-score-item">
        <img src="img/numq.svg" />
        <div class="tpc-score-text">
        <span class="tpc-val">${item.qmax} Questions</span>
        </div>
        </div>

        <div class="tpc-score-item">
        <img src="img/duration.svg" />
        <div class="tpc-score-text">
        <span class="tpc-val">${item.totaltime}</span>
        </div>
        </div>

        <div class="tpc-score-item">
        <img src="img/marks.svg" />
        <div class="tpc-score-text">
        <span class="tpc-val">${item.scoremax} Marks</span>
        </div>
        </div>

        </div>

        </div>
        <div class="mob-tag">
        <span class="lc-tag tag-cmn"><img src="img/tslock.png" alt=""></span>
        </div>
        <div class="tpc-col-actions start_test_container">

        <button class="tpc-btn-main btn_unlock">
        <img src="img/lockoutline.svg" />
        Unlock
        </button>

        </div>

        </div>
        `;
}
function renderComingSoonTest(item) {
    let csoontext = 'Coming Soon';
    if((item.date != undefined)&&(item.date != '')){
        csoontext = item.date.replace('[','').replace(']','');
    }
    return `
        <div class="tpc-card start_test_card" style="cursor:default;">

        <div class="tpc-col-info">

        <h3 class="tpc-title">
        ${item.testname}
    ${item.isfree == 1 ? '<span class="cls-tag">Free</span>' : ''}
        </h3>

        <div class="tpc-scores">

        <div class="tpc-score-item">
        <img src="img/numq.svg" />
        <div class="tpc-score-text">
        <span class="tpc-val">${item.qmax} Questions</span>
        </div>
        </div>

        <div class="tpc-score-item">
        <img src="img/duration.svg" />
        <div class="tpc-score-text">
        <span class="tpc-val">${item.totaltime}</span>
        </div>
        </div>

        <div class="tpc-score-item">
        <img src="img/marks.svg" />
        <div class="tpc-score-text">
        <span class="tpc-val">${item.scoremax} Marks</span>
        </div>
        </div>

        </div>

        </div>
        <div class="mob-tag">
        <span class="cs-tag tag-cmn">Coming Soon</span>
        </div>
        <div class="tpc-col-actions start_test_container">

        <button class="tpc-btn-main btn_cms" style="cursor:default;">
        <img src="img/moon.svg" />
        ${csoontext} 
        </button>

        </div>

        </div>
        `;
}
function renderCountdownBanner(block, blockindx) {
    return `
        <div class="lmm-wrapper" id="ltcountdownblock-${blockindx}">

        <div class="lmm-bottom-banner">

        <div class="lmm-meta-group">

        <h3 class="lmm-title">${block.title}</h3>

        <div class="lmm-subtitle">
        <img src="img/ic-cal.svg" class="lmm-icon-cal" alt="">
        ${block.subtitle}
        </div>

        </div>

        <div class="lmm-inline-timer"
    style="display:none;"
    id="lmmtimer-${blockindx}">

        <div class="lmm-inline-block">
        <span class="lmm-in-num">XX</span>
        <span class="lmm-in-lbl">DAYS</span>
        </div>

        <div class="lmm-in-colon">:</div>

        <div class="lmm-inline-block">
        <span class="lmm-in-num">XX</span>
        <span class="lmm-in-lbl">HRS</span>
        </div>

        <div class="lmm-in-colon">:</div>

        <div class="lmm-inline-block">
        <span class="lmm-in-num">XX</span>
        <span class="lmm-in-lbl">MIN</span>
        </div>

        <div class="lmm-in-colon">:</div>

        <div class="lmm-inline-block">
        <span class="lmm-in-num">XX</span>
        <span class="lmm-in-lbl">SEC</span>
        </div>

        </div>

        </div>

        </div>
        `;
}
function removeHTMLTags(str) {
    if (!str) return '';
    return str.replace(/<[^>]*>/g, '');
}
$(document).on('click', '.completed_test', function(){
    if($(window).width() < 991){
        $('.mrp-mobile-container').css('display','flex');
    }
});

$(document).on("click", "#mob-sidebar", function () {
    $("#mobileMenu").addClass("open");
    $("html, body").css("overflow", "hidden");
});

$(document).on("click", "#closeMenu", function () {
    $("#mobileMenu").removeClass("open");
    $("html, body").css("overflow", "unset");
});

$(document).on("click", "#mobileMenu", function(e){
    if(e.target === this){
        $(this).removeClass("open");
    }
});
$(".totop").hide();
$('.totop').click(function (e) {
    e.preventDefault();
    $('html').animate({scrollTop: 0}, 500);
});
$(window).on("scroll", function () {
    var scrollTop = $(window).scrollTop();
    if (scrollTop > 300) {
        $('.totop').fadeIn();
    } else {
        $('.totop').fadeOut();
    }
});
$(document).on('click', '.mob-search', function () {
    var st_height = $('.hdr-main').height();
    $('.hdr-search-area').toggle();
    if ($('.hdr-search-area').is(':visible')) {
        $('.tabs-wrapper').css('top', '122px');
    } else {
        $('.tabs-wrapper').css('top', '63px');
    }
});
