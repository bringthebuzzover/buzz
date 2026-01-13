import "./collegeBanner.css"
import brown from "../../assets/ivies/brown.png"
import columbia from "../../assets/ivies/columbia.png"
import cornell from "../../assets/ivies/cornell.png"
import dartmouth from "../../assets/ivies/dartmouth.png"
import harvard from "../../assets/ivies/harvard.png"
import princeton from "../../assets/ivies/princeton.png"
import upenn from "../../assets/ivies/upenn.png"
import yale from "../../assets/ivies/yale.png"

const logos = [brown, columbia, cornell, dartmouth, harvard, princeton, yale, upenn]

export default function CollegeBanner() {
    return (
        <section className="college-network">
            <h2>
                Our College Network
            </h2>
            <div className="logo-carousel">
                <div className = "logo-track">
                    {[...logos, ...logos].map((logo,i) => (<img key = {i} src = {logo} alt = "College logo" />))}
                </div>
            </div>
            <p>
                Our ambassadors are ready to bring your brand to top campuses nationwide
            </p>
        </section>
    )
}