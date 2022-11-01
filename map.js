document.addEventListener("contextmenu", (event) => event.preventDefault()); //disable right click for map

const dateRange = 120;

fetch(
  `https://phl.carto.com/api/v2/sql?format=GeoJSON&q=SELECT * FROM public_cases_fc WHERE requested_datetime >= current_date - ${dateRange}`
)
  .then((response) => response.json())
  .then((data) => {
    const philly311 = data.features.filter(
      (d) => d.geometry !== null && d.properties.status === "Open"
    );

    let playPause = false;
    const playButton = document.createElement("div");
    playButton.id = "play";
    playButton.innerHTML = "▶";
    playButton.addEventListener("click", togglePlay);
    document.body.appendChild(playButton);

    let seconds = 0;

    function togglePlay() {
      if (playPause) {
        seconds = 0;
        playButton.innerHTML = "▶";
      } else {
        playButton.innerHTML = "X";
      }
      playPause = !playPause;
      console.log(playPause);
    }

    function incrementSeconds() {
      if (seconds == dateRange) {
        return (seconds = 0);
      }

      if (playPause) {
        seconds += 1;
        render();
      }
    }

    const interval = setInterval(incrementSeconds, 300);

    function waitTime(d, type = "color") {
      const filterWindowMin = seconds * (1000 * 3600 * 24); //number of days in millaseconds to look at over a given timeframe at one time
      const filterWindowMax = seconds + 15 * (1000 * 3600 * 24); //number of days in millaseconds to look at over a given timeframe at one time

      const ticketAge = [];
      for (i in d) {
        const submitDate = {};
        const rawDate = d[i].properties.requested_datetime
          .split("T")[0]
          .split("-");
        submitDate["year"] = rawDate[0];
        submitDate["month"] = rawDate[1];
        submitDate["day"] = rawDate[2];
        const date = new Date(
          `${submitDate.month} ${submitDate.day} ${submitDate.year}`
        ).getTime();

        const currentDate = new Date().getTime();
        ticketAge.push(currentDate - date);
      }

      filteredTicketAge = ticketAge.filter((e) => {
        if (playPause) {
          return e >= filterWindowMin;
        } else {
          return e;
        }
      });

      const average =
        filteredTicketAge.length >= 1
          ? Number(
              (
                filteredTicketAge.reduce((a, b) => a + b) /
                filteredTicketAge.length
              ).toFixed(0)
            )
          : 0;

      return type == "color" ? average : filteredTicketAge.length;
    }

    const deckgl = new deck.DeckGL({
      container: "map",
      // Set your Mapbox access token here
      mapboxApiAccessToken:
        "pk.eyJ1Ijoibmlrby1kZWxsaWMiLCJhIjoiY2w5c3p5bGx1MDh2eTNvcnVhdG0wYWxkMCJ9.4uQZqVYvQ51iZ64yG8oong",
      // Set your Mapbox style here
      mapStyle: "mapbox://styles/niko-dellic/cl9t226as000x14pr1hgle9az",
      initialViewState: {
        latitude: 39.9526,
        longitude: -75.1652,
        zoom: 12,
        bearing: 0,
        pitch: 0,
      },
      controller: true,

      getTooltip: ({ object }) => {
        if (object) {
          const originPoints = [];
          object.points.map((d, i) => {
            originPoints.push(d.source);
          });

          let TotalDays = Math.ceil(
            waitTime(originPoints) / (1000 * 3600 * 24)
          );

          // console.log();

          return (
            object && {
              html: `${waitTime(
                originPoints,
                "height"
              )} complaints in this hexagon. <br></br>
              Average current wait: ${TotalDays} Days`,
              style: { maxWidth: "300px", backgroundColor: "black" },
            }
          );
        }
      },
    });

    function render() {
      const layer = new deck.HexagonLayer({
        id: "hex-311", // layer id
        data: philly311, // data formatted as array of objects
        // Styles
        extruded: true,
        radius: 200,
        elevationScale: 4,
        getPosition: (d) => d.geometry.coordinates, // coordinates [lng, lat] for each data point
        pickable: true, // enable picking
        autoHighlight: true, // highlight on hover
        highlightColor: [255, 255, 255, 200], // highlight color
        getColorValue: (points) => waitTime(points, "color"),
        getElevationValue: (points) => {
          console.log("min", seconds, "max", seconds + 15);
          return waitTime(points, "height");
        },
        colorRange: [
          [237, 248, 251],
          [191, 211, 230],
          [158, 188, 218],
          [140, 150, 198],
          [136, 86, 167],
          [129, 15, 124],
        ],
        onClick: (info) => {
          flyToClick(info.object.position);
          panel.style.opacity = 1;

          const report = {};
          const reportAmount = {};
          info.object.points.forEach((element) => {
            report[element.source.properties.service_request_id] =
              element.source.properties.service_name;
          });

          const fullReportings = Object.values(report);
          for (i in fullReportings) {
            reportAmount[fullReportings[i]] =
              typeof reportAmount[fullReportings[i]] == "number"
                ? reportAmount[fullReportings[i]] + 1
                : 1;
          }

          let keyValuePair = Object.entries(reportAmount);
          keyValuePair.map((e) => (e[1] = `[${e[1]}]`));

          for (let i = 0; i < keyValuePair.length; i++) {
            keyValuePair[i] = keyValuePair[i].join(" ");
          }

          if (!document.querySelector("#exit")) {
            const exit = document.createElement("div");
            exit.id = "exit";
            exit.innerHTML = "X";
            exit.addEventListener("click", hidePanel);
            panel.appendChild(exit);
          }

          document.querySelector("#complaints")?.remove();
          const complaintsDiv = document.createElement("div");
          complaintsDiv.id = "complaints";
          complaintsDiv.innerHTML = `<h3>311 complaints in Philadelphia in the last 30 days</h3><p>${keyValuePair.join(
            ", "
          )}</p>`;
          panel.appendChild(complaintsDiv);
        },
        updateTriggers: {
          getColorValue: seconds,
          getElevationValue: seconds,
        },
      });

      deckgl.setProps({ layers: [layer] });
    }

    function flyToClick(coords) {
      deckgl.setProps({
        initialViewState: {
          longitude: coords[0],
          latitude: coords[1],
          zoom: 13,
          bearing: 10,
          pitch: 15,
          transitionDuration: 500,
          transitionInterpolator: new deck.FlyToInterpolator(),
        },
      });
    }
    function hidePanel() {
      document.getElementById("panel").style.opacity = 0;
    }
  });
