"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { showcaseCollections, showcaseFilters } from "../lib/showcase-collections";

export function ShowcaseGallery() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("All");

  const filteredCollections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return showcaseCollections.filter((collection) => {
      const matchesFilter =
        activeFilter === "All" ||
        collection.tags.includes(activeFilter) ||
        collection.occasion.toLowerCase().includes(activeFilter.toLowerCase()) ||
        collection.recipient.toLowerCase().includes(activeFilter.toLowerCase()) ||
        collection.title.toLowerCase().includes(activeFilter.toLowerCase());

      const searchableText = [
        collection.title,
        collection.occasion,
        collection.recipient,
        collection.storyPreview,
        collection.meaningPreview,
        ...collection.tags
      ]
        .join(" ")
        .toLowerCase();

      return matchesFilter && (!normalizedQuery || searchableText.includes(normalizedQuery));
    });
  }, [activeFilter, query]);

  return (
    <>
      <section className="showcase-controls" aria-label="Search real example collections">
        <div className="showcase-search">
          <label htmlFor="showcase-search">Search examples</label>
          <input
            id="showcase-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Father, Mother, Wedding, Christmas..."
          />
        </div>
        <div className="showcase-filter-row" aria-label="Filter examples by occasion or recipient">
          {["All", ...showcaseFilters].map((filter) => (
            <button
              key={filter}
              type="button"
              className="showcase-filter-button"
              data-active={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

      <p className="showcase-count">
        Showing {filteredCollections.length} of {showcaseCollections.length} real example
        collections.
      </p>

      <section className="showcase-grid" aria-label="Real example collections">
        {filteredCollections.map((collection) => (
          <article className="showcase-card" key={collection.id}>
            <Link href={`/real-examples/${collection.id}`} className="showcase-crest-link">
              <Image
                src={collection.crestSrc}
                alt={`${collection.title} final crest artwork`}
                width={720}
                height={720}
                sizes="(max-width: 640px) 92vw, (max-width: 1100px) 44vw, 28vw"
              />
            </Link>
            <div className="showcase-card-body">
              <p className="showcase-occasion">{collection.occasion}</p>
              <h2>{collection.title}</h2>
              <p>{collection.storyPreview}</p>
              <Link className="showcase-card-link" href={`/real-examples/${collection.id}`}>
                View Collection
              </Link>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
