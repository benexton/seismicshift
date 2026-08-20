function Go({ tab, onGoTo, children }) {
  return <button className="link-btn" onClick={() => onGoTo?.(tab)}>{children}</button>;
}

/**
 * Landing page shown first on login. Walks a new volunteer through the workflow,
 * leading with the triage queue (the core task), then the other tabs in the
 * order they are typically needed.
 */
export default function Instructions({ onGoTo }) {
  return (
    <div className="panel-scroll">
      <div className="panel-inner instructions">
        <h1>VERT Kumamoto triage - how it works</h1>
        <p>
          This tool gathers post-earthquake damage observations from social media
          (Bluesky) and news feeds, gives each a first-pass AI assessment, and
          asks volunteer engineers to verify them. Verified observations build up
          into a Learning from Earthquakes draft report. Here is the workflow.
        </p>

        <h2>1. Triage queue - the main task</h2>
        <p>
          The <Go tab="triage" onGoTo={onGoTo}>Triage queue</Go> is where most of the work
          happens. Each dot is an unverified observation waiting for a human to
          check. Open one by clicking it.
        </p>
        <p><b>Reading the map:</b></p>
        <p>
          The fill colour is the classification: green through dark red for
          damage D0 (none) to D4 (collapse), and a distinct blue for Great
          performance, used when a structure performed notably well. The coloured
          ring around a dot shows where the observation came from: white for a
          manual entry, blue for Bluesky, amber for news/RSS. A dashed red halo
          means the record looks like a possible duplicate of an already-triaged
          site. Where several observations share a location they collapse into a
          numbered badge; click it to fan them out. A violet ring means someone
          else currently has that record open, so you can avoid double-handling it.
        </p>
        <p><b>Reviewing a record:</b> in the panel you can correct the
          classification, observation type, mechanism, and coordinates. Scraped
          items often have only an approximate, geocoded location, so fixing the
          latitude and longitude to the true spot is one of the most valuable
          things you can do. This is also where the human adds value the AI
          cannot: adding a Google Street View screenshot, extra source links, and
          notes, and confirming the building attributes before it is verified.
        </p>
        <p><b>Four actions:</b> Cancel closes without changes. Save draft keeps
          your edits but leaves the record in the queue for later. Approve marks
          it verified and moves it to Triaged sites. Reject removes it, and asks
          you to confirm first because rejected records are hard to recover. If a
          record matches an existing site, use Merge instead, which folds its
          photo and link into that site rather than creating a duplicate.
        </p>

        <h2>2. Manual input - add your own observation</h2>
        <p>
          The <Go tab="manual" onGoTo={onGoTo}>Manual input</Go> tab is for entering an
          observation directly. Set an exact location by clicking the map or
          typing coordinates, then record what you saw: observation type, damage
          or Great performance, and for buildings the name, type, primary
          material, and height class. You can attach a photo and a Street View
          screenshot, set your confidence in the location, and add as many links
          as you like. Submitting sends it to the queue for a second person to
          verify, so entries are always checked by someone other than the author.
        </p>

        <h2>3. Scraper keywords - the automated feed</h2>
        <p>
          The <Go tab="scraper" onGoTo={onGoTo}>Scraper keywords</Go> tab controls what the
          automated pipeline watches: Bluesky search terms and news/RSS feeds.
          Add Japan-relevant terms or a campaign hashtag, and the scheduled job
          picks them up on its next run, fetches matching posts with images,
          triages them, and drops them into the queue. More specific place terms
          give better automatic locations.
        </p>

        <h2>4. Triaged sites - the verified record</h2>
        <p>
          Approved observations live in <Go tab="triaged" onGoTo={onGoTo}>Triaged sites</Go>.
          Click any site to review it and keep adding to it over time: more
          photos, extra source links, or notes as new information surfaces. This
          is the living record of each location.
        </p>

        <h2>5. Report generator</h2>
        <p>
          The <Go tab="report" onGoTo={onGoTo}>Report generator</Go> holds the event details
          (magnitude, epicentre, and so on, entered once) and turns all approved
          observations into a Learning from Earthquakes draft you can download and
          finish offline.
        </p>

        <p className="muted" style={{ marginTop: 24 }}>
          A note on the imagery: observations often include other people's photos.
          Keep the source link on every record, and treat the material with care.
        </p>
      </div>
    </div>
  );
}
