---
---

function resetSort() {
  /* Function to reset sort buttons */
  $('#current-sort').removeClass().addClass("sort-desc");
  $("#sort-by-date").removeClass().addClass("sort desc my-asc");
  $("#sort-by-difficulty").removeClass().addClass("sort my-desc");
}


function applySortFromURI(uri,featureList) {
  /* Function to update lesson-list using featureList and sort direction
    - uses URI to generate sort directions
  */
  console.log("applying sort from URI");

  const params = uri.search(true);
  let sortOrder = params.sortOrder;
  let sortType = params.sortType;
  let nonSortOrder = (sortOrder == "desc" ? "asc" : "desc");

  if (sortType) {
    console.log("SortType: " + sortType);
    console.log("sortOrder: " + sortOrder);
    console.log("nonSortOrder: " + nonSortOrder);

    // Update arrow of selected sort button
    $("#sort-by-" + sortType).removeClass().addClass("sort " + sortOrder + " my-" + nonSortOrder);

    // Update arrow of filter header
    $('#current-sort').removeClass().addClass("sort-" + sortOrder);

    // Update filter header and restore defaults to other button
    if (sortType == "date") {
      $('#current-sort').text(dateSort);
      $('#sort-by-difficulty').removeClass().addClass("sort my-asc");
    }
    else {
      $('#current-sort').text(difficultySort);
      $('#sort-by-date').removeClass().addClass("sort my-desc");
    }
  }
  else {
    // If no sort params, perform default sort
    console.log("default sorting");
    sortType = "date";
    sortOrder = "desc";

    // Set button classes to defaults
    resetSort();
  }

  // Performm new sort
  featureList.sort(sortType, {order: sortOrder});

  // Reset filter results header
  $('#results-value').text(featureList.update().items.length);
}

function lunrSearch(searchString, idx, corpus, featureList, uri, stateObj) {
  /* Function to generate search using lunr
    - find search results using index
    - load in original corpus and find relevant lessons
    - generate new html to show search snippet
    - use featureList to show lessons with search results (also relevant filters)
    - display html
  */

  // Get lessons that contain search string using lunr index
  const results = idx.search(searchString);

  // Get lessons from corpus that contain the search string
  let docs = results.filter(result => corpus.some(doc => result.ref === doc.url)).map(result => {
    let doc = corpus.find(o => o.url === result.ref);
    return {
      ...result,
      ...doc
    };
  });

  const BUFFER = 30 // Number of characters to show for kwic-results
  const MAX_KWIC = 3
  // Create html to show search results using html mark
  let elements = []
  docs.map((doc) => {
    let elementName = '/'+doc.url.split('/').slice(3, ).join('/')
    let search_keys = Object.keys(doc.matchData.metadata);
    let inner_results = search_keys.map((token) => {
      let all_positions = doc.matchData.metadata[token].body.position;
      let grouped_kwic = all_positions.slice(0, MAX_KWIC).map(function (pos) {
        let loc1 = pos[0]
        let loc2 = loc1 + pos[1]
        let rendered_text = `... ${doc.body.substring(loc1 - BUFFER, loc1)} <mark>${doc.body.substring(loc1, loc2)}</mark> ${doc.body.substring(loc2, loc2 + BUFFER)} ...`
        return rendered_text
      }).join("")
      return grouped_kwic
    }).join("").replace(/(\r\n|\n|\r)/gm, "");
    elements.push({'elementName': elementName, 'innerResults': inner_results});
    
  });
  // Filter featureList to only show items from search results and active filters
  const params = uri.search(true);
  let type = params.activity ? params.activity : params.topic;
  featureList.filter((item) => {
    let topicsArray = item.values().topics.split(/\s/);
    let condition = params.topic ? topicsArray.includes(type) : item.values().activity == type;
    // Could simply to just do Object.keys(params) > 1 here but in case we add more URI values this will explicitly check for filters along with search
    return docs.find((doc) => {
      return ['topic', 'activity'].some(key => Object.keys(params).includes(key)) ? ((doc.title === item.values().title) && condition) : (doc.title === item.values().title);

    });
  });
  // Hide original abstracts
  $('.abstract').css('display', 'none');
  $('#results-value').text($(this).text().split(' ')[0] + '(' + featureList.update().matchingItems.length + ')' + " ");
  $('#results-value').css('textTransform', 'uppercase');
  // Display updated search results
  elements.map( (elm) => {
    $(`p[id="${elm.elementName}-search_results"]`).css('display', '');
    $(`p[id="${elm.elementName}-search_results"]`).html(elm.innerResults);
  });
}

function resetSearch() {
  /* Function to reset search values and display to original settings */
  // Empty search input
  $('#search').val('');
  // Hide and empty search results
  $('.search_results').css('display', 'none');
  $('.search_results').html('');
  // Show original abstract results
  $('.abstract').css('display', 'block');
};

function wireButtons() {
  /* Main function for page load */

  // set URI object to current Window location
  let uri = new URI(location);
  console.log(uri.toString());

  let options = {
    valueNames: [ 'date', 'title', 'difficulty', 'activity', 'topics','abstract', 'content' ]
  };

  let featureList = new List('lesson-list', options);
  // We need a stateObj for adjusting the URIs on button clicks, but the value is moot for now; could be useful for future functionality.
  let stateObj = { foo: "bar" };

  // Get search indices and corpuses using URI to make a call to search-index for each language
  let idx;
  let corpus;

  async function loadSearchData() {
    /*Function to load search data asynchronously*/

    // Hide enable button and show search input
    $("#enable-search-div").css("display", "none");
    $("#search-div").css("display", "");
    $('#loading-search').css('display', 'none');
    $('#search').css('display', '');
    $('#search-button').prop('disabled', false);
    
    // Get language and load idx and corpus
    const language = uri.toString().split('/').slice(-3)[0];
    const indexResponse = await fetch(`https://programminghistorian.github.io/search-index/indices/index${language.toUpperCase()}.json`);
    const indexJSON = await indexResponse.json();
    idx = lunr.Index.load(indexJSON);
    const corpusResponse = await fetch(`https://programminghistorian.org/${language}/search.json`);
    const corpusJSON = await corpusResponse.json();
    corpus = corpusJSON;
    
  }

  // Enable search on button click
  $("#enable-search-div").on("click", function() {
    // Start loading search data
    loadSearchData();
  });


  // Search lessons on button click
  $("#search-button").on("click", function() {
    // Get search string
    const searchString = $("#search").val();

    // Update URI to include search string
    searchString.length > 0 ? uri.setSearch("search", searchString) : uri.removeSearch('search');
    history.pushState(stateObj, "", uri.toString());
    console.log(uri.toString());
    // Check that's it's not empty
    if (searchString.length > 0) {
      // Call lunr search
      lunrSearch(searchString, idx, corpus, featureList, uri, stateObj);
    } else {
      // If empty check if topic or activity filter selected

      // Call reset search to empty out search values
      resetSearch();

      const params = uri.search(true);
      let type = params.activity ? params.activity : params.topic;
      if (type) {
        // If filter selected, return filter lessons based on URI
        
        featureList.filter((item) => {
          let topicsArray = item.values().topics.split(/\s/);
          let condition = params.topic ? topicsArray.includes(type) : item.values().activity == type;
          return condition
        });
        // Reset filter results header
        $('#results-value').text($(this).text().split(' ')[0] + '(' + featureList.update().matchingItems.length + ')' + " ");
        $('#results-value').css('textTransform', 'uppercase');
      } else {
        // Else 
        applySortFromURI(uri, featureList);
      }
    }
  
  });
  // Search lessons on enter press
  $('#search').on('keyup', function(event) {
    if (event.which == 13) {
      $("#search-button").click();
    }
  });

  // When a filter button is clicked
  $('.filter').children().click(function() {
    // Set clicked button as current
    $('.filter').children().removeClass("current");
    $(this).addClass("current");

    let type = $(this).attr("id").substr(7);
    let filterType = $(this).parent().attr('class').split(' ')[1];
    // Reset url parameters
    if (filterType === 'activities') {
      uri.removeSearch("topic")
      uri.setSearch("activity", type)
    } else {
      uri.removeSearch("activity")
      uri.setSearch("topic", type)
    }
    
     // returns the URI instance for chaining
    history.pushState(stateObj, "", uri.toString());
    console.log(uri.toString());
    // Use search to perform filtering
    $("#search-button").click();

    return false;
  });
  
  // When the reset button is clicked
  $('#filter-none').click(function() {
    // Remove highlighting from filter buttons
    $('.filter').children().removeClass("current");

    // Reset filter results header
    $('#results-value').text(featureList.update().items.length);
    
    // Reset search results
    resetSearch();


    // Reset uri to remove query params
    uri.search("");
    history.pushState(stateObj, "", uri.toString());

    // Reset filtering and perform default sort
    featureList.filter();
    
    featureList.sort('date', { order: "desc" });
    // Reset sort buttons to defaults
    resetSort();
    resetSearch(uri, stateObj);
  });


  // When a sort button is clicked, update the results header to show current sorting status
  $('.sort').click(function() {
    
    // Get sort type from button (date or difficulty)
    let sortType = $(this).attr("data-sort");

    // Get sort order info from button
    let curSortOrder = $(this).hasClass("my-asc") ? "desc" : "asc";
    let newSortOrder = (curSortOrder == "asc" ? "desc" : "asc");

    console.log("curSort:" + curSortOrder);
    console.log("newSort:" + newSortOrder);

    // update class for clicked button
    $(this).removeClass("my-" + newSortOrder).addClass("my-" + curSortOrder);

    // Update filter results header to show current sorting (date or difficulty)
    // Reset the other (non-pressed) button to its default sort arrow.
    if (sortType == "date") {
      $('#current-sort').text(dateSort);
      $('#sort-by-difficulty').removeClass().addClass("sort my-asc");
    }
    else {
      $('#current-sort').text(difficultySort);
      $('#sort-by-date').removeClass().addClass("sort my-desc");
    }

    // Set CSS class for results header (the arrow)
    $('#current-sort').removeClass().addClass("sort-"+newSortOrder);

    // Manually sort to override default behavior of list.js, which does not support multiple sort buttons very well.
    // The problem is that when changing sort type, list.js automatically sorts asc on the first sort. This is not
    // necessarily what we want to do.
    featureList.sort(sortType, { order: newSortOrder });

    // update url parameters
    uri.setSearch("sortType", sortType);
    uri.setSearch("sortOrder", newSortOrder);
    history.pushState(stateObj, "", uri.toString());
    console.log(uri.toString());
  });

  /***************************************
    All below code runs on each page load
  ****************************************/

  // set labels based on the current language

  const dateSort = $('#date-sort-text').attr('label');
  const difficultySort = $('#difficulty-sort-text').attr("label");

  // Look for URI query params
  const params = uri.search(true);
  let filter = params.activity ? params.activity : params.topic;
  let search = params.search;
  
  // If a filter or search is present in the URI, simulate a click to run filter
  // Clicking a filter button checks for sort params in URI, so don't do it twice OR load search data and simulate search click.
  if (search) {
    $('#search').val(search);
    loadSearchData().then(() => $('#search-button').click()).catch(e => console.log(e));
  } else if (filter) {
    console.log("FILTER:" + filter);
    $("#filter-" + filter).click();
  }
  else {
    // Apply sorting criteria from the URI if no filter
    applySortFromURI(uri,featureList);
  }
};
